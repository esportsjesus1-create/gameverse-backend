"""Tests for utility functions."""

import pytest
from datetime import datetime, timedelta

from app.fraud_ml.utils.statistics import (
    calculate_zscore,
    calculate_mad_score,
    calculate_entropy,
    calculate_variance,
    windowed_aggregation,
    normalize_score,
    calculate_statistics,
)
from app.fraud_ml.utils.time_utils import (
    get_time_window,
    calculate_time_delta,
    is_impossible_travel,
    haversine_distance,
    calculate_session_duration,
)


class TestStatistics:
    """Tests for statistical utility functions."""
    
    def test_calculate_zscore_normal(self):
        """Test z-score calculation with normal values."""
        zscore = calculate_zscore(10, 5, 2)
        assert zscore == 2.5
    
    def test_calculate_zscore_zero_std(self):
        """Test z-score with zero standard deviation."""
        zscore = calculate_zscore(5, 5, 0)
        assert zscore == 0.0
        
        zscore = calculate_zscore(10, 5, 0)
        assert zscore == float('inf')
        
        zscore = calculate_zscore(0, 5, 0)
        assert zscore == float('-inf')
    
    def test_calculate_mad_score_normal(self):
        """Test MAD score calculation."""
        mad_score = calculate_mad_score(10, 5, 2)
        expected = (10 - 5) / (1.4826 * 2)
        assert abs(mad_score - expected) < 0.001
    
    def test_calculate_mad_score_zero_mad(self):
        """Test MAD score with zero MAD."""
        score = calculate_mad_score(5, 5, 0)
        assert score == 0.0
        
        score = calculate_mad_score(10, 5, 0)
        assert score == float('inf')
    
    def test_calculate_entropy_uniform(self):
        """Test entropy of uniform distribution."""
        probs = [0.25, 0.25, 0.25, 0.25]
        entropy = calculate_entropy(probs)
        assert abs(entropy - 2.0) < 0.001  # log2(4) = 2
    
    def test_calculate_entropy_single(self):
        """Test entropy of single outcome."""
        probs = [1.0]
        entropy = calculate_entropy(probs)
        assert entropy == 0.0
    
    def test_calculate_entropy_empty(self):
        """Test entropy of empty distribution."""
        entropy = calculate_entropy([])
        assert entropy == 0.0
    
    def test_calculate_variance(self):
        """Test variance calculation."""
        values = [1, 2, 3, 4, 5]
        variance = calculate_variance(values)
        assert abs(variance - 2.0) < 0.001
    
    def test_calculate_variance_single(self):
        """Test variance with single value."""
        variance = calculate_variance([5])
        assert variance == 0.0
    
    def test_calculate_variance_empty(self):
        """Test variance with empty list."""
        variance = calculate_variance([])
        assert variance == 0.0
    
    def test_windowed_aggregation_sum(self):
        """Test windowed aggregation with sum."""
        now = datetime.utcnow()
        values = [
            (now - timedelta(minutes=30), 10),
            (now - timedelta(minutes=20), 20),
            (now - timedelta(minutes=10), 30),
        ]
        
        result = windowed_aggregation(
            values,
            now - timedelta(hours=1),
            now,
            "sum"
        )
        assert result == 60
    
    def test_windowed_aggregation_count(self):
        """Test windowed aggregation with count."""
        now = datetime.utcnow()
        values = [
            (now - timedelta(minutes=30), 10),
            (now - timedelta(minutes=20), 20),
            (now - timedelta(minutes=10), 30),
        ]
        
        result = windowed_aggregation(
            values,
            now - timedelta(hours=1),
            now,
            "count"
        )
        assert result == 3.0
    
    def test_windowed_aggregation_mean(self):
        """Test windowed aggregation with mean."""
        now = datetime.utcnow()
        values = [
            (now - timedelta(minutes=30), 10),
            (now - timedelta(minutes=20), 20),
            (now - timedelta(minutes=10), 30),
        ]
        
        result = windowed_aggregation(
            values,
            now - timedelta(hours=1),
            now,
            "mean"
        )
        assert result == 20.0
    
    def test_windowed_aggregation_empty(self):
        """Test windowed aggregation with no values in window."""
        now = datetime.utcnow()
        values = [
            (now - timedelta(hours=2), 10),
        ]
        
        result = windowed_aggregation(
            values,
            now - timedelta(hours=1),
            now,
            "sum"
        )
        assert result == 0.0
    
    def test_windowed_aggregation_invalid(self):
        """Test windowed aggregation with invalid aggregation type."""
        now = datetime.utcnow()
        values = [(now, 10)]
        
        with pytest.raises(ValueError):
            windowed_aggregation(values, now - timedelta(hours=1), now, "invalid")
    
    def test_normalize_score(self):
        """Test score normalization."""
        score = normalize_score(0)
        assert abs(score - 0.5) < 0.001
        
        score = normalize_score(5)
        assert score > 0.99
        
        score = normalize_score(-5)
        assert score < 0.01
    
    def test_calculate_statistics(self):
        """Test comprehensive statistics calculation."""
        values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        stats = calculate_statistics(values)
        
        assert stats["count"] == 10
        assert abs(stats["mean"] - 5.5) < 0.001
        assert stats["min"] == 1.0
        assert stats["max"] == 10.0
        assert stats["median"] == 5.5
    
    def test_calculate_statistics_empty(self):
        """Test statistics with empty list."""
        stats = calculate_statistics([])
        
        assert stats["count"] == 0
        assert stats["mean"] == 0.0


class TestTimeUtils:
    """Tests for time utility functions."""
    
    def test_get_time_window_backward(self):
        """Test backward time window."""
        now = datetime.utcnow()
        start, end = get_time_window(now, 60, "backward")
        
        assert end == now
        assert (now - start).total_seconds() == 3600
    
    def test_get_time_window_forward(self):
        """Test forward time window."""
        now = datetime.utcnow()
        start, end = get_time_window(now, 60, "forward")
        
        assert start == now
        assert (end - now).total_seconds() == 3600
    
    def test_get_time_window_centered(self):
        """Test centered time window."""
        now = datetime.utcnow()
        start, end = get_time_window(now, 60, "centered")
        
        assert (now - start).total_seconds() == 1800
        assert (end - now).total_seconds() == 1800
    
    def test_get_time_window_invalid(self):
        """Test invalid direction."""
        with pytest.raises(ValueError):
            get_time_window(datetime.utcnow(), 60, "invalid")
    
    def test_calculate_time_delta_seconds(self):
        """Test time delta in seconds."""
        t1 = datetime.utcnow()
        t2 = t1 + timedelta(minutes=5)
        
        delta = calculate_time_delta(t1, t2, "seconds")
        assert delta == 300
    
    def test_calculate_time_delta_minutes(self):
        """Test time delta in minutes."""
        t1 = datetime.utcnow()
        t2 = t1 + timedelta(hours=2)
        
        delta = calculate_time_delta(t1, t2, "minutes")
        assert delta == 120
    
    def test_calculate_time_delta_hours(self):
        """Test time delta in hours."""
        t1 = datetime.utcnow()
        t2 = t1 + timedelta(days=1)
        
        delta = calculate_time_delta(t1, t2, "hours")
        assert delta == 24
    
    def test_calculate_time_delta_invalid(self):
        """Test invalid unit."""
        with pytest.raises(ValueError):
            calculate_time_delta(datetime.utcnow(), datetime.utcnow(), "invalid")
    
    def test_haversine_distance(self):
        """Test haversine distance calculation."""
        # New York to Los Angeles (approximately 3940 km)
        distance = haversine_distance(40.7128, -74.0060, 34.0522, -118.2437)
        assert 3900 < distance < 4000
    
    def test_haversine_distance_same_point(self):
        """Test distance between same point."""
        distance = haversine_distance(40.7128, -74.0060, 40.7128, -74.0060)
        assert distance == 0.0
    
    def test_is_impossible_travel_possible(self):
        """Test possible travel."""
        is_impossible, reason = is_impossible_travel(
            "US-East", "US-West", 6.0  # 6 hours to cross US is possible by plane
        )
        assert not is_impossible
    
    def test_is_impossible_travel_impossible(self):
        """Test impossible travel."""
        is_impossible, reason = is_impossible_travel(
            "US-East", "Asia-East", 0.5  # 30 minutes from US to Japan is impossible
        )
        assert is_impossible
    
    def test_is_impossible_travel_zero_time(self):
        """Test zero time delta."""
        is_impossible, reason = is_impossible_travel(
            "US-East", "US-West", 0
        )
        assert is_impossible
    
    def test_is_impossible_travel_unknown_location(self):
        """Test unknown location."""
        is_impossible, reason = is_impossible_travel(
            "Unknown", "US-West", 1.0
        )
        assert not is_impossible
        assert "Unknown location" in reason
    
    def test_calculate_session_duration(self):
        """Test session duration calculation."""
        now = datetime.utcnow()
        events = [
            now,
            now + timedelta(minutes=10),
            now + timedelta(minutes=30),
        ]
        
        duration = calculate_session_duration(events)
        assert duration == 30.0
    
    def test_calculate_session_duration_single(self):
        """Test session duration with single event."""
        duration = calculate_session_duration([datetime.utcnow()])
        assert duration is None
    
    def test_calculate_session_duration_empty(self):
        """Test session duration with no events."""
        duration = calculate_session_duration([])
        assert duration is None
