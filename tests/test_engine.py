"""Tests for fraud detection engine components."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from app.fraud_ml.engine.base import BaseDetector, DetectorRegistry
from app.fraud_ml.engine.feature_extractor import FeatureExtractor
from app.fraud_ml.engine.scoring_engine import ScoringEngine
from app.fraud_ml.engine.fraud_engine import FraudEngine
from app.fraud_ml.models.schemas import (
    UserEvent,
    Transaction,
    BehaviorEvent,
    DetectorResult,
    FraudScore,
    RiskLevel,
    EventType,
    TransactionType,
)


class MockDetector(BaseDetector):
    """Mock detector for testing."""
    
    def __init__(self, name: str = "mock", score: float = 0.5, confidence: float = 0.8):
        super().__init__(name)
        self._score = score
        self._confidence = confidence
    
    def detect(self, features: dict) -> DetectorResult:
        return DetectorResult(
            detector_name=self.name,
            score=self._score,
            confidence=self._confidence,
            reasons=["Mock detection"],
        )


class TestDetectorRegistry:
    """Tests for DetectorRegistry."""
    
    def test_register_detector(self, detector_registry):
        """Test registering a detector."""
        detector = MockDetector("test_detector")
        detector_registry.register(detector)
        
        assert "test_detector" in detector_registry
        assert len(detector_registry) == 1
    
    def test_get_detector(self, detector_registry):
        """Test getting a detector by name."""
        detector = MockDetector("test_detector")
        detector_registry.register(detector)
        
        retrieved = detector_registry.get("test_detector")
        assert retrieved is detector
    
    def test_get_nonexistent_detector(self, detector_registry):
        """Test getting a nonexistent detector."""
        result = detector_registry.get("nonexistent")
        assert result is None
    
    def test_unregister_detector(self, detector_registry):
        """Test unregistering a detector."""
        detector = MockDetector("test_detector")
        detector_registry.register(detector)
        
        removed = detector_registry.unregister("test_detector")
        assert removed is detector
        assert "test_detector" not in detector_registry
    
    def test_get_all_detectors(self, detector_registry):
        """Test getting all detectors."""
        detector1 = MockDetector("detector1")
        detector2 = MockDetector("detector2")
        
        detector_registry.register(detector1)
        detector_registry.register(detector2)
        
        all_detectors = detector_registry.get_all()
        assert len(all_detectors) == 2
    
    def test_get_enabled_detectors(self, detector_registry):
        """Test getting only enabled detectors."""
        detector1 = MockDetector("detector1")
        detector2 = MockDetector("detector2")
        detector2.disable()
        
        detector_registry.register(detector1)
        detector_registry.register(detector2)
        
        enabled = detector_registry.get_enabled()
        assert len(enabled) == 1
        assert enabled[0].name == "detector1"
    
    def test_clear_registry(self, detector_registry):
        """Test clearing the registry."""
        detector_registry.register(MockDetector("test"))
        detector_registry.clear()
        
        assert len(detector_registry) == 0


class TestBaseDetector:
    """Tests for BaseDetector."""
    
    def test_detector_weight(self):
        """Test detector weight management."""
        detector = MockDetector("test")
        assert detector.get_weight() == 1.0
        
        detector.set_weight(2.5)
        assert detector.get_weight() == 2.5
    
    def test_detector_weight_bounds(self):
        """Test detector weight bounds."""
        detector = MockDetector("test")
        
        detector.set_weight(15.0)  # Should be clamped to 10
        assert detector.get_weight() == 10.0
        
        detector.set_weight(-5.0)  # Should be clamped to 0
        assert detector.get_weight() == 0.0
    
    def test_detector_enable_disable(self):
        """Test enabling and disabling detector."""
        detector = MockDetector("test")
        assert detector.is_enabled()
        
        detector.disable()
        assert not detector.is_enabled()
        
        detector.enable()
        assert detector.is_enabled()


class TestFeatureExtractor:
    """Tests for FeatureExtractor."""
    
    def test_extract_empty_features(self, feature_extractor):
        """Test feature extraction with no data."""
        features = feature_extractor.extract_user_features(
            user_id="user_1",
            events=[],
            transactions=[],
            behavior_events=[],
        )
        
        assert features["user_id"] == "user_1"
        assert features["event_count_1h"] == 0
        assert features["tx_count_1h"] == 0
    
    def test_extract_event_features(self, feature_extractor, sample_events_batch):
        """Test event feature extraction."""
        features = feature_extractor.extract_user_features(
            user_id="test_user_1",
            events=sample_events_batch,
            transactions=[],
            behavior_events=[],
        )
        
        assert features["event_count_24h"] > 0
        assert features["unique_event_types"] >= 1
    
    def test_extract_transaction_features(self, feature_extractor, sample_transactions_batch):
        """Test transaction feature extraction."""
        features = feature_extractor.extract_user_features(
            user_id="test_user_1",
            events=[],
            transactions=sample_transactions_batch,
            behavior_events=[],
        )
        
        assert features["tx_count_24h"] > 0
        assert features["tx_total_amount_24h"] > 0
        assert features["tx_avg_amount"] > 0
    
    def test_extract_behavior_features(self, feature_extractor, sample_behavior_batch):
        """Test behavior feature extraction."""
        features = feature_extractor.extract_user_features(
            user_id="test_user_1",
            events=[],
            transactions=[],
            behavior_events=sample_behavior_batch,
        )
        
        assert features["behavior_count_1h"] > 0
        assert features["unique_actions"] > 0
        assert features["action_entropy"] > 0
    
    def test_update_user_baseline(self, feature_extractor):
        """Test user baseline update."""
        features = {
            "event_count_1h": 10,
            "tx_count_1h": 5,
        }
        
        feature_extractor.update_user_baseline("user_1", features)
        baseline = feature_extractor.get_user_baseline("user_1")
        
        assert baseline["event_count_1h"] == 10
        assert baseline["tx_count_1h"] == 5
    
    def test_baseline_exponential_average(self, feature_extractor):
        """Test baseline exponential moving average."""
        features1 = {"event_count_1h": 10}
        features2 = {"event_count_1h": 20}
        
        feature_extractor.update_user_baseline("user_1", features1, alpha=0.5)
        feature_extractor.update_user_baseline("user_1", features2, alpha=0.5)
        
        baseline = feature_extractor.get_user_baseline("user_1")
        # With alpha=0.5: 0.5 * 20 + 0.5 * 10 = 15
        assert baseline["event_count_1h"] == 15
    
    def test_deviation_from_baseline(self, feature_extractor):
        """Test deviation calculation from baseline."""
        baseline_features = {"event_count_1h": 10}
        current_features = {"event_count_1h": 30}
        
        feature_extractor.update_user_baseline("user_1", baseline_features)
        deviations = feature_extractor.calculate_deviation_from_baseline(
            "user_1", current_features
        )
        
        # Deviation should be (30-10)/10 = 2.0
        assert deviations["event_count_1h"] == 2.0


class TestScoringEngine:
    """Tests for ScoringEngine."""
    
    def test_calculate_risk_score_empty(self, scoring_engine):
        """Test risk score with no detector results."""
        score = scoring_engine.calculate_risk_score(
            detector_results=[],
            entity_id="user_1",
        )
        
        assert score.overall_score == 0.0
        assert score.risk_level == RiskLevel.LOW
    
    def test_calculate_risk_score_single(self, scoring_engine, detector_registry):
        """Test risk score with single detector."""
        detector = MockDetector("test", score=0.7, confidence=1.0)
        detector_registry.register(detector)
        
        results = [
            DetectorResult(
                detector_name="test",
                score=0.7,
                confidence=1.0,
                reasons=["Test"],
            )
        ]
        
        score = scoring_engine.calculate_risk_score(
            detector_results=results,
            entity_id="user_1",
        )
        
        assert score.overall_score > 0
        assert score.entity_id == "user_1"
    
    def test_calculate_risk_score_multiple(self, scoring_engine, detector_registry):
        """Test risk score with multiple detectors."""
        detector1 = MockDetector("detector1", score=0.8)
        detector2 = MockDetector("detector2", score=0.4)
        
        detector_registry.register(detector1)
        detector_registry.register(detector2)
        
        results = [
            DetectorResult(detector_name="detector1", score=0.8, confidence=1.0),
            DetectorResult(detector_name="detector2", score=0.4, confidence=1.0),
        ]
        
        score = scoring_engine.calculate_risk_score(
            detector_results=results,
            entity_id="user_1",
        )
        
        assert 0 < score.overall_score < 1
    
    def test_risk_level_thresholds(self, scoring_engine):
        """Test risk level determination."""
        # Low risk
        results = [DetectorResult(detector_name="test", score=0.1, confidence=1.0)]
        score = scoring_engine.calculate_risk_score(results, "user_1")
        assert score.risk_level == RiskLevel.LOW
    
    def test_run_detectors(self, scoring_engine, detector_registry):
        """Test running all detectors."""
        detector1 = MockDetector("detector1", score=0.5)
        detector2 = MockDetector("detector2", score=0.3)
        
        # Register detectors to the scoring engine's registry (same as detector_registry fixture)
        scoring_engine.registry.register(detector1)
        scoring_engine.registry.register(detector2)
        
        results = scoring_engine.run_detectors({"test": "features"})
        
        assert len(results) == 2
    
    def test_set_threshold(self, scoring_engine):
        """Test setting risk thresholds."""
        scoring_engine.set_threshold(RiskLevel.HIGH, 0.7)
        thresholds = scoring_engine.get_thresholds()
        
        assert thresholds[RiskLevel.HIGH] == 0.7


class TestFraudEngine:
    """Tests for FraudEngine."""
    
    def test_engine_initialization(self):
        """Test fraud engine initialization."""
        engine = FraudEngine()
        
        assert engine.anomaly_detector is not None
        assert engine.behavior_detector is not None
        assert engine.transaction_monitor is not None
        assert engine.bot_detector is not None
    
    def test_engine_selective_initialization(self):
        """Test engine with selective detector initialization."""
        engine = FraudEngine(
            enable_anomaly_detection=False,
            enable_bot_detection=False,
        )
        
        assert engine.anomaly_detector is None
        assert engine.bot_detector is None
        assert engine.behavior_detector is not None
    
    def test_add_event(self, fraud_engine, sample_user_event):
        """Test adding an event."""
        fraud_engine.add_event(sample_user_event)
        
        history = fraud_engine.get_user_risk_history(sample_user_event.user_id)
        assert history["event_count"] == 1
    
    def test_add_transaction(self, fraud_engine, sample_transaction):
        """Test adding a transaction."""
        fraud_engine.add_transaction(sample_transaction)
        
        history = fraud_engine.get_user_risk_history(sample_transaction.user_id)
        assert history["transaction_count"] == 1
    
    def test_add_behavior_event(self, fraud_engine, sample_behavior_event):
        """Test adding a behavior event."""
        fraud_engine.add_behavior_event(sample_behavior_event)
        
        history = fraud_engine.get_user_risk_history(sample_behavior_event.user_id)
        assert history["behavior_event_count"] == 1
    
    def test_analyze_user(self, fraud_engine, sample_events_batch):
        """Test user analysis."""
        for event in sample_events_batch:
            fraud_engine.add_event(event)
        
        score, flag = fraud_engine.analyze_user("test_user_1")
        
        assert score is not None
        assert score.entity_id == "test_user_1"
        assert 0 <= score.overall_score <= 1
    
    def test_analyze_transaction(self, fraud_engine, sample_transaction):
        """Test transaction analysis."""
        score, flag = fraud_engine.analyze_transaction(sample_transaction)
        
        assert score is not None
        assert score.entity_type == "transaction"
    
    def test_analyze_behavior(self, fraud_engine, sample_behavior_batch):
        """Test behavior analysis."""
        score, flag = fraud_engine.analyze_behavior(
            "test_user_1",
            sample_behavior_batch
        )
        
        assert score is not None
        assert score.entity_type == "user_behavior"
    
    def test_is_user_blocked(self, fraud_engine):
        """Test user block status."""
        assert not fraud_engine.is_user_blocked("user_1")
    
    def test_get_user_flags(self, fraud_engine):
        """Test getting user flags."""
        flags = fraud_engine.get_user_flags("user_1")
        assert isinstance(flags, list)
    
    def test_get_statistics(self, fraud_engine):
        """Test getting engine statistics."""
        stats = fraud_engine.get_statistics()
        
        assert "detectors" in stats
        assert "storage" in stats
        assert "flagging" in stats
    
    def test_configure_detector(self, fraud_engine):
        """Test detector configuration."""
        success = fraud_engine.configure_detector(
            "anomaly_detector",
            weight=2.0,
            enabled=True
        )
        
        assert success
    
    def test_configure_nonexistent_detector(self, fraud_engine):
        """Test configuring nonexistent detector."""
        success = fraud_engine.configure_detector(
            "nonexistent",
            weight=1.0
        )
        
        assert not success
    
    def test_clear_user_data(self, fraud_engine, sample_events_batch):
        """Test clearing user data."""
        for event in sample_events_batch:
            fraud_engine.add_event(event)
        
        fraud_engine.clear_user_data("test_user_1")
        
        history = fraud_engine.get_user_risk_history("test_user_1")
        assert history["event_count"] == 0
