"""Risk scoring engine for fraud detection."""

import math
from typing import Any, Optional

from ..models.schemas import (
    DetectorResult,
    FraudScore,
    RiskLevel,
)
from .base import BaseDetector, DetectorRegistry


class ScoringEngine:
    """
    Combines detector results into a unified risk score.
    
    Uses a weighted ensemble approach with configurable thresholds.
    """
    
    # Default risk level thresholds
    DEFAULT_THRESHOLDS = {
        RiskLevel.LOW: 0.0,
        RiskLevel.MEDIUM: 0.3,
        RiskLevel.HIGH: 0.6,
        RiskLevel.CRITICAL: 0.85,
    }
    
    def __init__(
        self,
        registry: Optional[DetectorRegistry] = None,
        thresholds: Optional[dict[RiskLevel, float]] = None,
        use_sigmoid: bool = True,
    ):
        """
        Initialize the scoring engine.
        
        Args:
            registry: Detector registry to use
            thresholds: Custom risk level thresholds
            use_sigmoid: Whether to apply sigmoid normalization
        """
        self.registry = registry or DetectorRegistry()
        self.thresholds = thresholds or self.DEFAULT_THRESHOLDS.copy()
        self.use_sigmoid = use_sigmoid
    
    def calculate_risk_score(
        self,
        detector_results: list[DetectorResult],
        entity_id: str,
        entity_type: str = "user",
    ) -> FraudScore:
        """
        Calculate overall risk score from detector results.
        
        Args:
            detector_results: List of results from individual detectors
            entity_id: Entity identifier
            entity_type: Type of entity
            
        Returns:
            FraudScore with overall score and risk level
        """
        if not detector_results:
            return FraudScore(
                entity_id=entity_id,
                entity_type=entity_type,
                overall_score=0.0,
                risk_level=RiskLevel.LOW,
                detector_results=[],
            )
        
        # Calculate weighted score
        total_weight = 0.0
        weighted_sum = 0.0
        
        for result in detector_results:
            detector = self.registry.get(result.detector_name)
            weight = detector.get_weight() if detector else 1.0
            
            # Weight by both detector weight and confidence
            effective_weight = weight * result.confidence
            weighted_sum += result.score * effective_weight
            total_weight += effective_weight
        
        # Calculate raw score
        if total_weight > 0:
            raw_score = weighted_sum / total_weight
        else:
            raw_score = 0.0
        
        # Apply sigmoid normalization if enabled
        if self.use_sigmoid:
            overall_score = self._sigmoid_normalize(raw_score)
        else:
            overall_score = max(0.0, min(1.0, raw_score))
        
        # Determine risk level
        risk_level = self._determine_risk_level(overall_score)
        
        return FraudScore(
            entity_id=entity_id,
            entity_type=entity_type,
            overall_score=overall_score,
            risk_level=risk_level,
            detector_results=detector_results,
            metadata={
                "raw_score": raw_score,
                "total_weight": total_weight,
                "detector_count": len(detector_results),
            },
        )
    
    def _sigmoid_normalize(self, score: float, steepness: float = 5.0) -> float:
        """
        Apply sigmoid normalization to a score.
        
        Maps scores to 0-1 range with smooth transitions.
        
        Args:
            score: Raw score (typically 0-1)
            steepness: Controls how sharp the transition is
            
        Returns:
            Normalized score between 0 and 1
        """
        # Shift score to center sigmoid around 0.5
        shifted = (score - 0.5) * steepness
        return 1 / (1 + math.exp(-shifted))
    
    def _determine_risk_level(self, score: float) -> RiskLevel:
        """
        Determine risk level from score.
        
        Args:
            score: Overall risk score (0-1)
            
        Returns:
            Appropriate RiskLevel
        """
        if score >= self.thresholds[RiskLevel.CRITICAL]:
            return RiskLevel.CRITICAL
        elif score >= self.thresholds[RiskLevel.HIGH]:
            return RiskLevel.HIGH
        elif score >= self.thresholds[RiskLevel.MEDIUM]:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    def run_detectors(
        self,
        features: dict[str, Any],
    ) -> list[DetectorResult]:
        """
        Run all enabled detectors on features.
        
        Args:
            features: Extracted features dictionary
            
        Returns:
            List of detector results
        """
        results = []
        
        for detector in self.registry.get_enabled():
            try:
                result = detector.detect(features)
                results.append(result)
            except Exception as e:
                # Log error but continue with other detectors
                results.append(DetectorResult(
                    detector_name=detector.name,
                    score=0.0,
                    confidence=0.0,
                    reasons=[f"Detector error: {str(e)}"],
                ))
        
        return results
    
    def set_threshold(self, level: RiskLevel, threshold: float) -> None:
        """
        Set a risk level threshold.
        
        Args:
            level: Risk level to set threshold for
            threshold: New threshold value (0-1)
        """
        self.thresholds[level] = max(0.0, min(1.0, threshold))
    
    def get_thresholds(self) -> dict[RiskLevel, float]:
        """Get current risk level thresholds."""
        return self.thresholds.copy()
