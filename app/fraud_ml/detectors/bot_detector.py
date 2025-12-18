"""Bot detection for fraud prevention."""

from collections import Counter
from typing import Any, Optional

import numpy as np
from sklearn.ensemble import IsolationForest

from ..engine.base import BaseDetector
from ..models.schemas import DetectorResult


class BotDetector(BaseDetector):
    """
    Detects bot-like behavior through timing and interaction analysis.
    
    Key signals:
    - Near-constant inter-action intervals
    - Extremely low timing variance
    - Superhuman click/keypress frequency
    - Repeated identical action paths
    - High similarity across accounts/devices
    - Input jitter absence
    """
    
    # Thresholds for bot detection
    MIN_HUMAN_VARIANCE_MS = 50  # Humans have at least 50ms variance
    MAX_HUMAN_ACTIONS_PER_SECOND = 10  # Humans can't do more than 10 actions/sec
    MIN_HUMAN_ENTROPY = 0.3  # Humans have some randomness
    SIMILARITY_THRESHOLD = 0.95  # High similarity indicates bot
    
    def __init__(
        self,
        name: str = "bot_detector",
        weight: float = 1.2,
        enabled: bool = True,
        use_ml: bool = True,
    ):
        """
        Initialize the bot detector.
        
        Args:
            name: Detector name
            weight: Weight in ensemble scoring
            enabled: Whether detector is active
            use_ml: Whether to use ML-based detection
        """
        super().__init__(name, weight, enabled)
        self.use_ml = use_ml
        
        # ML model for bot detection
        self._isolation_forest: Optional[IsolationForest] = None
        self._training_data: list[list[float]] = []
        self._min_samples = 50
        
        # Known bot signatures
        self._known_bot_patterns: list[dict[str, Any]] = []
        
        # Device fingerprint tracking
        self._device_fingerprints: dict[str, list[dict[str, Any]]] = {}
    
    def detect(self, features: dict[str, Any]) -> DetectorResult:
        """
        Detect bot-like behavior.
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            DetectorResult with bot detection score and reasons
        """
        reasons = []
        scores = []
        
        # Timing analysis
        timing_score, timing_reasons = self._analyze_timing(features)
        if timing_score > 0:
            scores.append(timing_score)
            reasons.extend(timing_reasons)
        
        # Action pattern analysis
        pattern_score, pattern_reasons = self._analyze_action_patterns(features)
        if pattern_score > 0:
            scores.append(pattern_score)
            reasons.extend(pattern_reasons)
        
        # Input analysis
        input_score, input_reasons = self._analyze_input_patterns(features)
        if input_score > 0:
            scores.append(input_score)
            reasons.extend(input_reasons)
        
        # Session analysis
        session_score, session_reasons = self._analyze_session_patterns(features)
        if session_score > 0:
            scores.append(session_score)
            reasons.extend(session_reasons)
        
        # ML-based detection
        if self.use_ml and self._isolation_forest is not None:
            ml_score, ml_reasons = self._ml_detection(features)
            if ml_score > 0:
                scores.append(ml_score)
                reasons.extend(ml_reasons)
        
        # Calculate overall score
        if scores:
            # Use max for bot detection (any strong signal is concerning)
            overall_score = max(scores)
        else:
            overall_score = 0.0
        
        # Calculate confidence
        confidence = self._calculate_confidence(features)
        
        # Update training data
        self._update_training_data(features)
        
        return DetectorResult(
            detector_name=self.name,
            score=min(1.0, overall_score),
            confidence=confidence,
            reasons=reasons,
            metadata={
                "timing_score": timing_score,
                "pattern_score": pattern_score,
                "input_score": input_score,
                "session_score": session_score,
                "is_likely_bot": overall_score > 0.7,
            },
        )
    
    def _analyze_timing(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze timing patterns for bot-like regularity.
        """
        reasons = []
        score = 0.0
        
        inter_time_mean = features.get("inter_action_time_mean", 0)
        inter_time_variance = features.get("inter_action_time_variance", 0)
        avg_duration_ms = features.get("avg_action_duration_ms", 0)
        duration_variance = features.get("action_duration_variance", 0)
        
        # Check for suspiciously low timing variance
        if inter_time_mean > 0:
            # Convert to milliseconds for comparison
            variance_ms = inter_time_variance * 1000000  # seconds^2 to ms^2
            
            if variance_ms < self.MIN_HUMAN_VARIANCE_MS ** 2:
                variance_score = 0.85
                score = max(score, variance_score)
                reasons.append(
                    f"Bot-like timing regularity: variance={variance_ms:.2f}ms^2 "
                    f"(human minimum: {self.MIN_HUMAN_VARIANCE_MS**2}ms^2)"
                )
        
        # Check for superhuman speed
        if inter_time_mean > 0 and inter_time_mean < 1 / self.MAX_HUMAN_ACTIONS_PER_SECOND:
            speed_score = 0.9
            score = max(score, speed_score)
            actions_per_sec = 1 / inter_time_mean if inter_time_mean > 0 else 0
            reasons.append(
                f"Superhuman action speed: {actions_per_sec:.1f} actions/second "
                f"(human max: {self.MAX_HUMAN_ACTIONS_PER_SECOND})"
            )
        
        # Check for suspiciously consistent action durations
        if avg_duration_ms > 0 and duration_variance < 100:  # Less than 10ms std
            duration_score = 0.7
            score = max(score, duration_score)
            reasons.append(
                f"Suspiciously consistent action durations: "
                f"avg={avg_duration_ms:.1f}ms, variance={duration_variance:.1f}ms^2"
            )
        
        return score, reasons
    
    def _analyze_action_patterns(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze action patterns for repetitive bot behavior.
        """
        reasons = []
        score = 0.0
        
        action_entropy = features.get("action_entropy", 0.5)
        unique_actions = features.get("unique_actions", 0)
        behavior_count = features.get("behavior_count_1h", 0)
        
        # Check for very low entropy (repetitive actions)
        if behavior_count > 20 and action_entropy < self.MIN_HUMAN_ENTROPY:
            entropy_score = (self.MIN_HUMAN_ENTROPY - action_entropy) / self.MIN_HUMAN_ENTROPY
            entropy_score = min(0.8, entropy_score)
            score = max(score, entropy_score)
            reasons.append(
                f"Highly repetitive action pattern: entropy={action_entropy:.3f} "
                f"(human minimum: {self.MIN_HUMAN_ENTROPY})"
            )
        
        # Check for single action dominance
        if behavior_count > 50 and unique_actions == 1:
            single_action_score = 0.85
            score = max(score, single_action_score)
            reasons.append(
                f"Single action repeated {behavior_count} times (bot-like)"
            )
        
        return score, reasons
    
    def _analyze_input_patterns(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze input patterns for bot characteristics.
        """
        reasons = []
        score = 0.0
        
        # Check for lack of input variety (from metadata if available)
        metadata = features.get("metadata", {})
        
        input_types = metadata.get("input_types", [])
        if input_types and len(set(input_types)) == 1 and len(input_types) > 10:
            input_score = 0.5
            score = max(score, input_score)
            reasons.append(
                f"Single input type used: {input_types[0]} for all {len(input_types)} actions"
            )
        
        # Check for pixel-perfect coordinates (bots often click exact same spots)
        coordinates = metadata.get("coordinates", [])
        if coordinates and len(coordinates) > 10:
            unique_coords = len(set(coordinates))
            coord_ratio = unique_coords / len(coordinates)
            
            if coord_ratio < 0.1:  # Less than 10% unique coordinates
                coord_score = 0.75
                score = max(score, coord_score)
                reasons.append(
                    f"Repetitive click coordinates: {unique_coords} unique out of "
                    f"{len(coordinates)} clicks"
                )
        
        return score, reasons
    
    def _analyze_session_patterns(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze session-level patterns for bot behavior.
        """
        reasons = []
        score = 0.0
        
        event_count_1h = features.get("event_count_1h", 0)
        event_count_24h = features.get("event_count_24h", 0)
        avg_events_per_session = features.get("avg_events_per_session", 0)
        
        # Check for 24/7 activity (bots don't sleep)
        if event_count_24h > 0:
            # Calculate activity distribution (simplified)
            hourly_rate = event_count_24h / 24
            
            # If current hour rate is similar to average (no sleep pattern)
            if event_count_1h > 0 and hourly_rate > 0:
                rate_ratio = event_count_1h / hourly_rate
                
                # Humans have variable activity; bots are consistent
                # This is a simplified check
                if 0.8 < rate_ratio < 1.2 and event_count_24h > 100:
                    consistency_score = 0.4
                    score = max(score, consistency_score)
                    reasons.append(
                        f"Suspiciously consistent activity pattern: "
                        f"hourly rate ratio={rate_ratio:.2f}"
                    )
        
        # Check for extremely high session activity
        if avg_events_per_session > 1000:
            session_score = min(0.9, avg_events_per_session / 2000)
            score = max(score, session_score)
            reasons.append(
                f"Extremely high session activity: {avg_events_per_session:.0f} events/session"
            )
        
        return score, reasons
    
    def _ml_detection(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        ML-based bot detection using Isolation Forest.
        """
        reasons = []
        
        # Extract feature vector
        feature_vector = self._extract_feature_vector(features)
        if feature_vector is None:
            return 0.0, []
        
        try:
            # Get anomaly score
            raw_score = self._isolation_forest.score_samples([feature_vector])[0]
            
            # Convert to 0-1 scale (more negative = more anomalous/bot-like)
            # Typical range is -0.5 to 0.5
            normalized_score = max(0, min(1, 0.5 - raw_score))
            
            if normalized_score > 0.6:
                reasons.append(
                    f"ML model detected bot-like behavior: score={normalized_score:.3f}"
                )
            
            return normalized_score, reasons
        except Exception:
            return 0.0, []
    
    def _extract_feature_vector(
        self,
        features: dict[str, Any],
    ) -> Optional[list[float]]:
        """Extract feature vector for ML model."""
        bot_features = [
            "inter_action_time_mean",
            "inter_action_time_variance",
            "action_entropy",
            "behavior_count_1h",
            "unique_actions",
            "avg_action_duration_ms",
            "action_duration_variance",
            "action_burstiness",
        ]
        
        vector = []
        for feature_name in bot_features:
            value = features.get(feature_name, 0)
            if isinstance(value, (int, float)):
                vector.append(float(value))
            else:
                vector.append(0.0)
        
        if all(v == 0 for v in vector):
            return None
        
        return vector
    
    def _calculate_confidence(self, features: dict[str, Any]) -> float:
        """Calculate confidence based on available data."""
        required_features = [
            "inter_action_time_mean",
            "inter_action_time_variance",
            "action_entropy",
            "behavior_count_1h",
        ]
        
        available = sum(1 for f in required_features if features.get(f) is not None)
        return available / len(required_features)
    
    def _update_training_data(self, features: dict[str, Any]) -> None:
        """Update training data for ML model."""
        feature_vector = self._extract_feature_vector(features)
        if feature_vector is None:
            return
        
        self._training_data.append(feature_vector)
        
        # Keep bounded
        if len(self._training_data) > 5000:
            self._training_data = self._training_data[-5000:]
        
        # Train model periodically
        if (self.use_ml and 
            len(self._training_data) >= self._min_samples and
            len(self._training_data) % 50 == 0):
            self._train_model()
    
    def _train_model(self) -> None:
        """Train the Isolation Forest model."""
        if len(self._training_data) < self._min_samples:
            return
        
        self._isolation_forest = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100,
        )
        self._isolation_forest.fit(self._training_data)
    
    def add_known_bot_pattern(
        self,
        pattern: dict[str, Any],
    ) -> None:
        """
        Add a known bot pattern for signature matching.
        
        Args:
            pattern: Dictionary describing the bot pattern
        """
        self._known_bot_patterns.append(pattern)
    
    def check_known_patterns(
        self,
        features: dict[str, Any],
    ) -> tuple[bool, Optional[str]]:
        """
        Check if features match any known bot patterns.
        
        Args:
            features: Feature dictionary
            
        Returns:
            Tuple of (is_match, pattern_name)
        """
        for pattern in self._known_bot_patterns:
            match = True
            for key, expected in pattern.items():
                if key == "name":
                    continue
                
                actual = features.get(key)
                if actual is None:
                    match = False
                    break
                
                # Check if within tolerance
                if isinstance(expected, dict):
                    min_val = expected.get("min", float("-inf"))
                    max_val = expected.get("max", float("inf"))
                    if not (min_val <= actual <= max_val):
                        match = False
                        break
                elif actual != expected:
                    match = False
                    break
            
            if match:
                return True, pattern.get("name", "unknown")
        
        return False, None
