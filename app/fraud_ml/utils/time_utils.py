"""Time-related utility functions for fraud detection."""

from datetime import datetime, timedelta
from typing import Optional


def get_time_window(
    reference_time: datetime,
    window_minutes: int = 60,
    direction: str = "backward"
) -> tuple[datetime, datetime]:
    """
    Get a time window relative to a reference time.
    
    Args:
        reference_time: The reference timestamp
        window_minutes: Size of the window in minutes
        direction: 'backward' (past), 'forward' (future), or 'centered'
        
    Returns:
        Tuple of (window_start, window_end)
    """
    delta = timedelta(minutes=window_minutes)
    
    if direction == "backward":
        return (reference_time - delta, reference_time)
    elif direction == "forward":
        return (reference_time, reference_time + delta)
    elif direction == "centered":
        half_delta = timedelta(minutes=window_minutes / 2)
        return (reference_time - half_delta, reference_time + half_delta)
    else:
        raise ValueError(f"Unknown direction: {direction}")


def calculate_time_delta(
    timestamp1: datetime,
    timestamp2: datetime,
    unit: str = "seconds"
) -> float:
    """
    Calculate time difference between two timestamps.
    
    Args:
        timestamp1: First timestamp
        timestamp2: Second timestamp
        unit: Unit for result ('seconds', 'minutes', 'hours', 'days')
        
    Returns:
        Time difference in specified unit (absolute value)
    """
    delta = abs((timestamp2 - timestamp1).total_seconds())
    
    if unit == "seconds":
        return delta
    elif unit == "minutes":
        return delta / 60
    elif unit == "hours":
        return delta / 3600
    elif unit == "days":
        return delta / 86400
    else:
        raise ValueError(f"Unknown unit: {unit}")


# Approximate travel speeds in km/h for different modes
TRAVEL_SPEEDS = {
    "walking": 5,
    "driving": 120,
    "flying": 900,
    "max_possible": 1200,  # Supersonic, essentially impossible for regular users
}

# Approximate coordinates for major regions (simplified)
GEO_COORDINATES: dict[str, tuple[float, float]] = {
    "US-East": (40.7128, -74.0060),  # New York
    "US-West": (37.7749, -122.4194),  # San Francisco
    "US-Central": (41.8781, -87.6298),  # Chicago
    "EU-West": (51.5074, -0.1278),  # London
    "EU-Central": (52.5200, 13.4050),  # Berlin
    "Asia-East": (35.6762, 139.6503),  # Tokyo
    "Asia-South": (1.3521, 103.8198),  # Singapore
}


def haversine_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two points on Earth.
    
    Args:
        lat1, lon1: Coordinates of first point (degrees)
        lat2, lon2: Coordinates of second point (degrees)
        
    Returns:
        Distance in kilometers
    """
    import math
    
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def is_impossible_travel(
    location1: str,
    location2: str,
    time_delta_hours: float,
    coordinates1: Optional[tuple[float, float]] = None,
    coordinates2: Optional[tuple[float, float]] = None,
) -> tuple[bool, str]:
    """
    Check if travel between two locations in given time is physically impossible.
    
    Args:
        location1: First location identifier or region
        location2: Second location identifier or region
        time_delta_hours: Time between events in hours
        coordinates1: Optional exact coordinates (lat, lon) for location1
        coordinates2: Optional exact coordinates (lat, lon) for location2
        
    Returns:
        Tuple of (is_impossible, reason)
    """
    if time_delta_hours <= 0:
        return True, "Negative or zero time delta"
    
    # Get coordinates
    if coordinates1:
        lat1, lon1 = coordinates1
    elif location1 in GEO_COORDINATES:
        lat1, lon1 = GEO_COORDINATES[location1]
    else:
        return False, "Unknown location1, cannot determine impossibility"
    
    if coordinates2:
        lat2, lon2 = coordinates2
    elif location2 in GEO_COORDINATES:
        lat2, lon2 = GEO_COORDINATES[location2]
    else:
        return False, "Unknown location2, cannot determine impossibility"
    
    # Calculate distance
    distance_km = haversine_distance(lat1, lon1, lat2, lon2)
    
    # Calculate required speed
    required_speed = distance_km / time_delta_hours
    
    # Check against maximum possible speed
    max_speed = TRAVEL_SPEEDS["max_possible"]
    
    if required_speed > max_speed:
        return True, f"Required speed {required_speed:.0f} km/h exceeds maximum possible {max_speed} km/h"
    
    # Check if it's suspicious (faster than commercial flight)
    if required_speed > TRAVEL_SPEEDS["flying"]:
        return False, f"Suspicious: Required speed {required_speed:.0f} km/h is faster than commercial flight"
    
    return False, f"Travel is possible at {required_speed:.0f} km/h"


def calculate_session_duration(
    events: list[datetime],
) -> Optional[float]:
    """
    Calculate session duration from a list of event timestamps.
    
    Args:
        events: List of event timestamps
        
    Returns:
        Session duration in minutes, or None if insufficient data
    """
    if len(events) < 2:
        return None
    
    sorted_events = sorted(events)
    duration_seconds = (sorted_events[-1] - sorted_events[0]).total_seconds()
    return duration_seconds / 60
