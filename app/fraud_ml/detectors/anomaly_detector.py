"""Anomaly detection using statistical methods and Isolation Forest."""

from typing import Any, Optional

import numpy as np
from sklearn.ensemble import IsolationForest

from ..engine.base import BaseDetector
from ..models.schemas import DetectorResult
from ..utils.statistics import calculate_zscore, calculate_mad_score, normalize_score


class AnomalyDetector(BaseDetector):
    """
    Detects anomalies using statistical baselines and Isolation Forest.
    
    Combines z-score/MAD-based detection with optional ML-based detection
    for robust anomaly identification.
    """
    
    # Features to analyze for anomalies
    ANOMALY_FEATURES = [
        "event_count_1h",
        "event_count_24h",
        "tx_count_1h",
        "tx_total_amount_1h",
        "tx_velocity_ratio",
        "unique_devices",
        "unique_ips",
        "unique_locations",
        "behavior_count_1h",
    ]
    
    # Z-score thresholds for anomaly detection
    ZSCORE_THRESHOLD = 3.0
    MAD_THRESHOLD = 3.5
    
    def __init__(
        self,
        name: str = "anomaly_detector",
        weight: float = 1.0,
        enabled: bool = True,
        use_isolation_forest: bool = True,
        contamination: float = 0.1,
    ):
        """
        Initialize the anomaly detector.
        
        Args:
            name: Detector name
            weight: Weight in ensemble scoring
            enabled: Whether detector is active
            use_isolation_forest: Whether to use Isolation Forest ML model
            contamination: Expected proportion of anomalies (for IF)
        """
        super().__init__(name, weight, enabled)
        self.use_isolation_forest = use_isolation_forest
        self.contamination = contamination
        
        # Global statistics for baseline comparison
        self._global_stats: dict[str, dict[str, float]] = {}
        self._sample_count = 0
        
        # Isolation Forest model
        self._isolation_forest: Optional[IsolationForest] = None
        self._training_data: list[list[float]] = []
        self._min_samples_for_training = 100
    
    def detect(self, features: dict[str, Any]) -> DetectorResult:
        """
        Detect anomalies in the provided features.
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            DetectorResult with anomaly score and reasons
        """
        reasons = []
        anomaly_scores = []
        
        # Statistical anomaly detection
        stat_score, stat_reasons = self._statistical_detection(features)
        anomaly_scores.append(stat_score)
        reasons.extend(stat_reasons)
        
        # Isolation Forest detection (if enabled and trained)
        if self.use_isolation_forest and self._isolation_forest is not None:
            if_score, if_reasons = self._isolation_forest_detection(features)
            anomaly_scores.append(if_score)
            reasons.extend(if_reasons)
        
        # Combine scores
        if anomaly_scores:
            overall_score = max(anomaly_scores)  # Use max for anomaly detection
        else:
            overall_score = 0.0
        
        # Calculate confidence based on data availability
        confidence = self._calculate_confidence(features)
        
        # Update statistics for future detection
        self._update_statistics(features)
        
        return DetectorResult(
            detector_name=self.name,
            score=overall_score,
            confidence=confidence,
            reasons=reasons,
            metadata={
                "statistical_score": stat_score if anomaly_scores else 0.0,
                "isolation_forest_score": anomaly_scores[1] if len(anomaly_scores) > 1 else None,
                "sample_count": self._sample_count,
            },
        )
    
    def _statistical_detection(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Perform statistical anomaly detection using z-scores and MAD.
        
        Args:
            features: Feature dictionary
            
        Returns:
            Tuple of (score, reasons)
        """
        reasons = []
        max_anomaly_score = 0.0
        
        for feature_name in self.ANOMALY_FEATURES:
            if feature_name not in features:
                continue
            
            value = features[feature_name]
            if not isinstance(value, (int, float)):
                continue
            
            # Get global statistics for this feature
            stats = self._global_stats.get(feature_name, {})
            
            if not stats:
                continue
            
            # Z-score detection
            zscore = calculate_zscore(value, stats.get("mean", 0), stats.get("std", 1))
            if abs(zscore) > self.ZSCORE_THRESHOLD:
                anomaly_score = min(1.0, abs(zscore) / (self.ZSCORE_THRESHOLD * 2))
                max_anomaly_score = max(max_anomaly_score, anomaly_score)
                reasons.append(
                    f"Anomalous {feature_name}: z-score={zscore:.2f} "
                    f"(value={value:.2f}, mean={stats.get('mean', 0):.2f})"
                )
            
            # MAD-based detection (more robust to outliers)
            mad_score = calculate_mad_score(
                value,
                stats.get("median", 0),
                stats.get("mad", 1)
            )
            if abs(mad_score) > self.MAD_THRESHOLD:
                anomaly_score = min(1.0, abs(mad_score) / (self.MAD_THRESHOLD * 2))
                max_anomaly_score = max(max_anomaly_score, anomaly_score)
                if f"Anomalous {feature_name}" not in str(reasons):
                    reasons.append(
                        f"MAD anomaly in {feature_name}: score={mad_score:.2f}"
                    )
        
        return max_anomaly_score, reasons
    
    def _isolation_forest_detection(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Perform Isolation Forest anomaly detection.
        
        Args:
            features: Feature dictionary
            
        Returns:
            Tuple of (score, reasons)
        """
        reasons = []
        
        # Extract feature vector
        feature_vector = self._extract_feature_vector(features)
        if feature_vector is None:
            return 0.0, []
        
        # Get anomaly score from Isolation Forest
        # score_samples returns negative scores, more negative = more anomalous
        try:
            raw_score = self._isolation_forest.score_samples([feature_vector])[0]
            # Convert to 0-1 scale (more positive raw_score = less anomalous)
            # Typical range is -0.5 to 0.5, we normalize this
            normalized_score = 1 - normalize_score(raw_score, 0, 1)
            
            if normalized_score > 0.5:
                reasons.append(
                    f"Isolation Forest anomaly detected: score={normalized_score:.3f}"
                )
            
            return normalized_score, reasons
        except Exception:
            return 0.0, []
    
    def _extract_feature_vector(
        self,
        features: dict[str, Any],
    ) -> Optional[list[float]]:
        """Extract numeric feature vector for ML model."""
        vector = []
        for feature_name in self.ANOMALY_FEATURES:
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
        available_features = sum(
            1 for f in self.ANOMALY_FEATURES
            if f in features and features[f] is not None
        )
        feature_confidence = available_features / len(self.ANOMALY_FEATURES)
        
        # Also consider sample count for statistical reliability
        sample_confidence = min(1.0, self._sample_count / 100)
        
        return (feature_confidence + sample_confidence) / 2
    
    def _update_statistics(self, features: dict[str, Any]) -> None:
        """Update global statistics with new sample."""
        self._sample_count += 1
        
        for feature_name in self.ANOMALY_FEATURES:
            if feature_name not in features:
                continue
            
            value = features[feature_name]
            if not isinstance(value, (int, float)):
                continue
            
            if feature_name not in self._global_stats:
                self._global_stats[feature_name] = {
                    "values": [],
                    "mean": 0.0,
                    "std": 1.0,
                    "median": 0.0,
                    "mad": 1.0,
                }
            
            stats = self._global_stats[feature_name]
            stats["values"].append(value)
            
            # Keep only recent values (sliding window)
            if len(stats["values"]) > 1000:
                stats["values"] = stats["values"][-1000:]
            
            # Update statistics
            values = np.array(stats["values"])
            stats["mean"] = float(np.mean(values))
            stats["std"] = float(np.std(values)) or 1.0
            stats["median"] = float(np.median(values))
            stats["mad"] = float(np.median(np.abs(values - stats["median"]))) or 1.0
        
        # Update training data for Isolation Forest
        feature_vector = self._extract_feature_vector(features)
        if feature_vector is not None:
            self._training_data.append(feature_vector)
            
            # Keep training data bounded
            if len(self._training_data) > 5000:
                self._training_data = self._training_data[-5000:]
            
            # Train/retrain Isolation Forest periodically
            if (self.use_isolation_forest and 
                len(self._training_data) >= self._min_samples_for_training and
                self._sample_count % 100 == 0):
                self._train_isolation_forest()
    
    def _train_isolation_forest(self) -> None:
        """Train or retrain the Isolation Forest model."""
        if len(self._training_data) < self._min_samples_for_training:
            return
        
        self._isolation_forest = IsolationForest(
            contamination=self.contamination,
            random_state=42,
            n_estimators=100,
        )
        self._isolation_forest.fit(self._training_data)
    
    def force_train(self) -> bool:
        """
        Force training of Isolation Forest with current data.
        
        Returns:
            True if training was successful
        """
        if len(self._training_data) < 10:
            return False
        
        self._train_isolation_forest()
        return self._isolation_forest is not None
    
    def get_statistics(self) -> dict[str, dict[str, float]]:
        """Get current global statistics."""
        return {
            k: {key: val for key, val in v.items() if key != "values"}
            for k, v in self._global_stats.items()
        }
