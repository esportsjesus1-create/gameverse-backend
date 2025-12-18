"""Statistical utility functions for fraud detection."""

import math
from collections.abc import Sequence
from datetime import datetime
from typing import Optional

import numpy as np


def calculate_zscore(value: float, mean: float, std: float) -> float:
    """
    Calculate z-score for a value given mean and standard deviation.
    
    Args:
        value: The value to calculate z-score for
        mean: Population mean
        std: Population standard deviation
        
    Returns:
        Z-score (number of standard deviations from mean)
    """
    if std == 0:
        return 0.0 if value == mean else float('inf') if value > mean else float('-inf')
    return (value - mean) / std


def calculate_mad_score(value: float, median: float, mad: float) -> float:
    """
    Calculate Median Absolute Deviation (MAD) score.
    
    MAD is more robust to outliers than standard deviation.
    
    Args:
        value: The value to calculate MAD score for
        median: Population median
        mad: Median absolute deviation
        
    Returns:
        MAD score (modified z-score)
    """
    if mad == 0:
        return 0.0 if value == median else float('inf') if value > median else float('-inf')
    k = 1.4826  # Consistency constant for normal distribution
    return (value - median) / (k * mad)


def calculate_entropy(probabilities: Sequence[float]) -> float:
    """
    Calculate Shannon entropy of a probability distribution.
    
    Higher entropy indicates more randomness/unpredictability.
    
    Args:
        probabilities: Sequence of probabilities (should sum to 1)
        
    Returns:
        Shannon entropy value
    """
    if not probabilities:
        return 0.0
    
    entropy = 0.0
    for p in probabilities:
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def calculate_variance(values: Sequence[float]) -> float:
    """
    Calculate variance of a sequence of values.
    
    Args:
        values: Sequence of numeric values
        
    Returns:
        Variance of the values
    """
    if len(values) < 2:
        return 0.0
    
    arr = np.array(values)
    return float(np.var(arr))


def windowed_aggregation(
    values: Sequence[tuple[datetime, float]],
    window_start: datetime,
    window_end: datetime,
    aggregation: str = "sum"
) -> float:
    """
    Aggregate values within a time window.
    
    Args:
        values: Sequence of (timestamp, value) tuples
        window_start: Start of the time window
        window_end: End of the time window
        aggregation: Type of aggregation ('sum', 'count', 'mean', 'max', 'min')
        
    Returns:
        Aggregated value
    """
    window_values = [
        v for ts, v in values
        if window_start <= ts <= window_end
    ]
    
    if not window_values:
        return 0.0
    
    if aggregation == "sum":
        return sum(window_values)
    elif aggregation == "count":
        return float(len(window_values))
    elif aggregation == "mean":
        return sum(window_values) / len(window_values)
    elif aggregation == "max":
        return max(window_values)
    elif aggregation == "min":
        return min(window_values)
    else:
        raise ValueError(f"Unknown aggregation type: {aggregation}")


def normalize_score(score: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """
    Normalize a score to a 0-1 range using sigmoid function.
    
    Args:
        score: Raw score to normalize
        min_val: Minimum output value
        max_val: Maximum output value
        
    Returns:
        Normalized score between min_val and max_val
    """
    sigmoid = 1 / (1 + math.exp(-score))
    return min_val + (max_val - min_val) * sigmoid


def calculate_statistics(values: Sequence[float]) -> dict[str, float]:
    """
    Calculate comprehensive statistics for a sequence of values.
    
    Args:
        values: Sequence of numeric values
        
    Returns:
        Dictionary with mean, std, median, mad, min, max, count
    """
    if not values:
        return {
            "mean": 0.0,
            "std": 0.0,
            "median": 0.0,
            "mad": 0.0,
            "min": 0.0,
            "max": 0.0,
            "count": 0,
        }
    
    arr = np.array(values)
    median = float(np.median(arr))
    mad = float(np.median(np.abs(arr - median)))
    
    return {
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr)),
        "median": median,
        "mad": mad,
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "count": len(values),
    }
