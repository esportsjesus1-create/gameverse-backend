"""Behavior pattern analysis for fraud detection."""

from collections import Counter, defaultdict
from typing import Any, Optional

import numpy as np

from ..engine.base import BaseDetector
from ..models.schemas import DetectorResult
from ..utils.statistics import calculate_entropy


class BehaviorPatternDetector(BaseDetector):
    """
    Detects suspicious behavior patterns through sequence and cadence analysis.
    
    Analyzes:
    - Action sequence patterns
    - Timing cadence and burstiness
    - Session behavior consistency
    - Deviation from user baseline
    """
    
    # Thresholds for suspicious behavior
    LOW_ENTROPY_THRESHOLD = 0.5  # Very repetitive actions
    HIGH_BURSTINESS_THRESHOLD = 2.0  # Irregular timing
    LOW_VARIANCE_THRESHOLD = 0.01  # Too consistent (bot-like)
    HIGH_DEVIATION_THRESHOLD = 3.0  # Major deviation from baseline
    
    def __init__(
        self,
        name: str = "behavior_pattern_detector",
        weight: float = 1.0,
        enabled: bool = True,
    ):
        """
        Initialize the behavior pattern detector.
        
        Args:
            name: Detector name
            weight: Weight in ensemble scoring
            enabled: Whether detector is active
        """
        super().__init__(name, weight, enabled)
        
        # User behavior baselines
        self._user_baselines: dict[str, dict[str, Any]] = {}
        
        # Action transition probabilities (Markov chain)
        self._transition_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._action_counts: dict[str, int] = defaultdict(int)
    
    def detect(self, features: dict[str, Any]) -> DetectorResult:
        """
        Detect suspicious behavior patterns.
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            DetectorResult with behavior score and reasons
        """
        reasons = []
        scores = []
        
        # Analyze action entropy (repetitiveness)
        entropy_score, entropy_reasons = self._analyze_action_entropy(features)
        if entropy_score > 0:
            scores.append(entropy_score)
            reasons.extend(entropy_reasons)
        
        # Analyze timing patterns
        timing_score, timing_reasons = self._analyze_timing_patterns(features)
        if timing_score > 0:
            scores.append(timing_score)
            reasons.extend(timing_reasons)
        
        # Analyze session behavior
        session_score, session_reasons = self._analyze_session_behavior(features)
        if session_score > 0:
            scores.append(session_score)
            reasons.extend(session_reasons)
        
        # Analyze deviation from baseline
        user_id = features.get("user_id")
        if user_id:
            deviation_score, deviation_reasons = self._analyze_baseline_deviation(
                user_id, features
            )
            if deviation_score > 0:
                scores.append(deviation_score)
                reasons.extend(deviation_reasons)
            
            # Update user baseline
            self._update_user_baseline(user_id, features)
        
        # Calculate overall score
        if scores:
            overall_score = sum(scores) / len(scores)
        else:
            overall_score = 0.0
        
        # Calculate confidence
        confidence = self._calculate_confidence(features)
        
        return DetectorResult(
            detector_name=self.name,
            score=min(1.0, overall_score),
            confidence=confidence,
            reasons=reasons,
            metadata={
                "entropy_score": entropy_score,
                "timing_score": timing_score,
                "session_score": session_score,
                "component_scores": scores,
            },
        )
    
    def _analyze_action_entropy(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze action entropy for repetitive patterns.
        
        Low entropy indicates very repetitive, potentially automated behavior.
        """
        reasons = []
        
        action_entropy = features.get("action_entropy", 0.5)
        unique_actions = features.get("unique_actions", 0)
        behavior_count = features.get("behavior_count_1h", 0)
        
        score = 0.0
        
        # Check for suspiciously low entropy with high activity
        if behavior_count > 10 and action_entropy < self.LOW_ENTROPY_THRESHOLD:
            score = (self.LOW_ENTROPY_THRESHOLD - action_entropy) / self.LOW_ENTROPY_THRESHOLD
            reasons.append(
                f"Repetitive behavior pattern: entropy={action_entropy:.3f}, "
                f"actions={behavior_count}, unique={unique_actions}"
            )
        
        # Check for very few unique actions despite high activity
        if behavior_count > 20 and unique_actions < 3:
            action_score = 0.5
            score = max(score, action_score)
            reasons.append(
                f"Limited action variety: only {unique_actions} unique actions "
                f"in {behavior_count} events"
            )
        
        return score, reasons
    
    def _analyze_timing_patterns(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze timing patterns for suspicious cadence.
        
        Looks for both too-regular (bot-like) and too-irregular (burst) patterns.
        """
        reasons = []
        score = 0.0
        
        inter_time_mean = features.get("inter_action_time_mean", 0)
        inter_time_variance = features.get("inter_action_time_variance", 0)
        burstiness = features.get("action_burstiness", 0)
        
        # Check for suspiciously low variance (too regular)
        if inter_time_mean > 0 and inter_time_variance < self.LOW_VARIANCE_THRESHOLD:
            variance_score = 0.7  # High suspicion for machine-like regularity
            score = max(score, variance_score)
            reasons.append(
                f"Suspiciously regular timing: variance={inter_time_variance:.4f}, "
                f"mean={inter_time_mean:.2f}s"
            )
        
        # Check for high burstiness (irregular bursts)
        if burstiness > self.HIGH_BURSTINESS_THRESHOLD:
            burst_score = min(1.0, burstiness / (self.HIGH_BURSTINESS_THRESHOLD * 2))
            score = max(score, burst_score)
            reasons.append(
                f"Irregular burst pattern: burstiness={burstiness:.2f}"
            )
        
        # Check for superhuman speed
        if inter_time_mean > 0 and inter_time_mean < 0.1:  # Less than 100ms between actions
            speed_score = 0.9
            score = max(score, speed_score)
            reasons.append(
                f"Superhuman action speed: {inter_time_mean*1000:.1f}ms between actions"
            )
        
        return score, reasons
    
    def _analyze_session_behavior(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze session-level behavior patterns.
        """
        reasons = []
        score = 0.0
        
        avg_events_per_session = features.get("avg_events_per_session", 0)
        event_count_1h = features.get("event_count_1h", 0)
        
        # Check for abnormally high activity per session
        if avg_events_per_session > 500:
            session_score = min(1.0, avg_events_per_session / 1000)
            score = max(score, session_score)
            reasons.append(
                f"Abnormally high session activity: {avg_events_per_session:.0f} events/session"
            )
        
        # Check for abnormally high hourly activity
        if event_count_1h > 1000:
            hourly_score = min(1.0, event_count_1h / 2000)
            score = max(score, hourly_score)
            reasons.append(
                f"Abnormally high hourly activity: {event_count_1h} events/hour"
            )
        
        return score, reasons
    
    def _analyze_baseline_deviation(
        self,
        user_id: str,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Analyze deviation from user's historical baseline.
        """
        reasons = []
        score = 0.0
        
        baseline = self._user_baselines.get(user_id, {})
        if not baseline:
            return 0.0, []
        
        # Features to compare against baseline
        comparison_features = [
            "action_entropy",
            "inter_action_time_mean",
            "behavior_count_1h",
            "unique_actions",
        ]
        
        deviations = []
        for feature_name in comparison_features:
            current = features.get(feature_name)
            baseline_val = baseline.get(feature_name)
            
            if current is None or baseline_val is None:
                continue
            
            if baseline_val != 0:
                deviation = abs(current - baseline_val) / abs(baseline_val)
            elif current != 0:
                deviation = 1.0
            else:
                deviation = 0.0
            
            deviations.append((feature_name, deviation))
            
            if deviation > self.HIGH_DEVIATION_THRESHOLD:
                feature_score = min(1.0, deviation / (self.HIGH_DEVIATION_THRESHOLD * 2))
                score = max(score, feature_score)
                reasons.append(
                    f"Significant deviation in {feature_name}: "
                    f"current={current:.2f}, baseline={baseline_val:.2f}, "
                    f"deviation={deviation:.1f}x"
                )
        
        return score, reasons
    
    def _update_user_baseline(
        self,
        user_id: str,
        features: dict[str, Any],
        alpha: float = 0.1,
    ) -> None:
        """Update user baseline with exponential moving average."""
        if user_id not in self._user_baselines:
            self._user_baselines[user_id] = {}
        
        baseline = self._user_baselines[user_id]
        
        update_features = [
            "action_entropy",
            "inter_action_time_mean",
            "inter_action_time_variance",
            "behavior_count_1h",
            "unique_actions",
            "action_burstiness",
        ]
        
        for feature_name in update_features:
            value = features.get(feature_name)
            if value is None or not isinstance(value, (int, float)):
                continue
            
            if feature_name in baseline:
                baseline[feature_name] = alpha * value + (1 - alpha) * baseline[feature_name]
            else:
                baseline[feature_name] = value
    
    def _calculate_confidence(self, features: dict[str, Any]) -> float:
        """Calculate confidence based on available data."""
        required_features = [
            "action_entropy",
            "inter_action_time_mean",
            "behavior_count_1h",
        ]
        
        available = sum(1 for f in required_features if features.get(f) is not None)
        return available / len(required_features)
    
    def update_transition_model(
        self,
        action_sequence: list[str],
    ) -> None:
        """
        Update action transition model with observed sequence.
        
        Args:
            action_sequence: List of actions in order
        """
        for i in range(len(action_sequence) - 1):
            current_action = action_sequence[i]
            next_action = action_sequence[i + 1]
            
            self._transition_counts[current_action][next_action] += 1
            self._action_counts[current_action] += 1
    
    def get_transition_probability(
        self,
        from_action: str,
        to_action: str,
    ) -> float:
        """
        Get probability of transitioning from one action to another.
        
        Args:
            from_action: Source action
            to_action: Target action
            
        Returns:
            Transition probability (0-1)
        """
        total = self._action_counts.get(from_action, 0)
        if total == 0:
            return 0.0
        
        count = self._transition_counts[from_action].get(to_action, 0)
        return count / total
    
    def calculate_sequence_probability(
        self,
        action_sequence: list[str],
    ) -> float:
        """
        Calculate probability of an action sequence based on transition model.
        
        Args:
            action_sequence: List of actions in order
            
        Returns:
            Log probability of the sequence
        """
        if len(action_sequence) < 2:
            return 0.0
        
        log_prob = 0.0
        for i in range(len(action_sequence) - 1):
            prob = self.get_transition_probability(
                action_sequence[i],
                action_sequence[i + 1]
            )
            if prob > 0:
                log_prob += np.log(prob)
            else:
                log_prob += np.log(1e-10)  # Small probability for unseen transitions
        
        return log_prob
    
    def get_user_baseline(self, user_id: str) -> dict[str, Any]:
        """Get baseline for a specific user."""
        return self._user_baselines.get(user_id, {})
