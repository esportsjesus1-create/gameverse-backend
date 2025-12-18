"""Base classes for fraud detectors."""

from abc import ABC, abstractmethod
from typing import Any, Optional

from ..models.schemas import DetectorResult


class BaseDetector(ABC):
    """Abstract base class for all fraud detectors."""
    
    def __init__(self, name: str, weight: float = 1.0, enabled: bool = True):
        """
        Initialize the detector.
        
        Args:
            name: Unique name for this detector
            weight: Weight for this detector in ensemble scoring
            enabled: Whether this detector is active
        """
        self.name = name
        self.weight = weight
        self.enabled = enabled
    
    @abstractmethod
    def detect(self, features: dict[str, Any]) -> DetectorResult:
        """
        Run detection on extracted features.
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            DetectorResult with score, confidence, and reasons
        """
        pass
    
    def is_enabled(self) -> bool:
        """Check if detector is enabled."""
        return self.enabled
    
    def get_weight(self) -> float:
        """Get detector weight for ensemble scoring."""
        return self.weight
    
    def set_weight(self, weight: float) -> None:
        """Set detector weight."""
        self.weight = max(0.0, min(weight, 10.0))  # Clamp between 0 and 10
    
    def enable(self) -> None:
        """Enable the detector."""
        self.enabled = True
    
    def disable(self) -> None:
        """Disable the detector."""
        self.enabled = False


class DetectorRegistry:
    """Registry for managing fraud detectors."""
    
    def __init__(self):
        self._detectors: dict[str, BaseDetector] = {}
    
    def register(self, detector: BaseDetector) -> None:
        """
        Register a detector.
        
        Args:
            detector: Detector instance to register
        """
        self._detectors[detector.name] = detector
    
    def unregister(self, name: str) -> Optional[BaseDetector]:
        """
        Unregister a detector by name.
        
        Args:
            name: Name of detector to unregister
            
        Returns:
            The unregistered detector, or None if not found
        """
        return self._detectors.pop(name, None)
    
    def get(self, name: str) -> Optional[BaseDetector]:
        """
        Get a detector by name.
        
        Args:
            name: Name of detector to get
            
        Returns:
            The detector, or None if not found
        """
        return self._detectors.get(name)
    
    def get_all(self) -> list[BaseDetector]:
        """Get all registered detectors."""
        return list(self._detectors.values())
    
    def get_enabled(self) -> list[BaseDetector]:
        """Get all enabled detectors."""
        return [d for d in self._detectors.values() if d.is_enabled()]
    
    def clear(self) -> None:
        """Clear all registered detectors."""
        self._detectors.clear()
    
    def __len__(self) -> int:
        return len(self._detectors)
    
    def __contains__(self, name: str) -> bool:
        return name in self._detectors
