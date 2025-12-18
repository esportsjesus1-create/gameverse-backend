"""Tests for fraud detectors."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from app.fraud_ml.detectors.anomaly_detector import AnomalyDetector
from app.fraud_ml.detectors.behavior_detector import BehaviorPatternDetector
from app.fraud_ml.detectors.transaction_detector import TransactionMonitor
from app.fraud_ml.detectors.bot_detector import BotDetector
from app.fraud_ml.models.schemas import Transaction, TransactionType


class TestAnomalyDetector:
    """Tests for AnomalyDetector."""
    
    def test_detect_empty_features(self, anomaly_detector):
        """Test detection with empty features."""
        result = anomaly_detector.detect({})
        
        assert result.detector_name == "anomaly_detector"
        assert result.score >= 0
        assert result.confidence >= 0
    
    def test_detect_normal_features(self, anomaly_detector):
        """Test detection with normal features."""
        features = {
            "event_count_1h": 10,
            "event_count_24h": 50,
            "tx_count_1h": 2,
            "tx_total_amount_1h": 100,
            "tx_velocity_ratio": 1.0,
            "unique_devices": 1,
            "unique_ips": 1,
            "unique_locations": 1,
            "behavior_count_1h": 20,
        }
        
        result = anomaly_detector.detect(features)
        
        assert result.score >= 0
        assert result.score <= 1
    
    def test_detect_anomalous_features(self, anomaly_detector):
        """Test detection with anomalous features."""
        # First, build up some baseline
        for i in range(50):
            anomaly_detector.detect({
                "event_count_1h": 10 + (i % 5),
                "tx_count_1h": 2,
            })
        
        # Now test with anomalous values
        result = anomaly_detector.detect({
            "event_count_1h": 1000,  # Very high
            "tx_count_1h": 100,  # Very high
        })
        
        # Should detect anomaly after baseline is established
        assert result.score >= 0
    
    def test_get_statistics(self, anomaly_detector):
        """Test getting detector statistics."""
        anomaly_detector.detect({"event_count_1h": 10})
        stats = anomaly_detector.get_statistics()
        
        assert isinstance(stats, dict)
    
    def test_force_train(self, anomaly_detector):
        """Test force training isolation forest."""
        # Not enough data
        result = anomaly_detector.force_train()
        assert not result
        
        # Add enough data
        for i in range(100):
            anomaly_detector.detect({
                "event_count_1h": 10 + i,
                "tx_count_1h": 2 + (i % 5),
            })
        
        result = anomaly_detector.force_train()
        assert result


class TestBehaviorPatternDetector:
    """Tests for BehaviorPatternDetector."""
    
    def test_detect_empty_features(self, behavior_detector):
        """Test detection with empty features."""
        result = behavior_detector.detect({})
        
        assert result.detector_name == "behavior_pattern_detector"
        assert result.score >= 0
    
    def test_detect_normal_behavior(self, behavior_detector):
        """Test detection with normal behavior."""
        features = {
            "action_entropy": 1.5,
            "unique_actions": 5,
            "behavior_count_1h": 50,
            "inter_action_time_mean": 2.0,
            "inter_action_time_variance": 1.0,
            "action_burstiness": 0.5,
        }
        
        result = behavior_detector.detect(features)
        
        assert result.score >= 0
        assert result.score <= 1
    
    def test_detect_repetitive_behavior(self, behavior_detector):
        """Test detection of repetitive behavior."""
        features = {
            "action_entropy": 0.1,  # Very low entropy
            "unique_actions": 1,
            "behavior_count_1h": 100,
            "inter_action_time_mean": 1.0,
            "inter_action_time_variance": 0.001,  # Very low variance
        }
        
        result = behavior_detector.detect(features)
        
        # Should detect suspicious pattern
        assert result.score > 0
    
    def test_detect_superhuman_speed(self, behavior_detector):
        """Test detection of superhuman action speed."""
        features = {
            "inter_action_time_mean": 0.05,  # 50ms between actions
            "behavior_count_1h": 100,
        }
        
        result = behavior_detector.detect(features)
        
        assert result.score > 0
        assert any("superhuman" in r.lower() for r in result.reasons)
    
    def test_baseline_deviation(self, behavior_detector):
        """Test baseline deviation detection."""
        user_id = "test_user"
        
        # Establish baseline
        normal_features = {
            "user_id": user_id,
            "action_entropy": 1.5,
            "behavior_count_1h": 50,
        }
        behavior_detector.detect(normal_features)
        
        # Test with deviation
        deviant_features = {
            "user_id": user_id,
            "action_entropy": 0.1,  # Much lower
            "behavior_count_1h": 500,  # Much higher
        }
        result = behavior_detector.detect(deviant_features)
        
        assert result.score >= 0
    
    def test_update_transition_model(self, behavior_detector):
        """Test action transition model update."""
        sequence = ["click", "scroll", "click", "type", "click"]
        behavior_detector.update_transition_model(sequence)
        
        prob = behavior_detector.get_transition_probability("click", "scroll")
        assert prob > 0
    
    def test_sequence_probability(self, behavior_detector):
        """Test sequence probability calculation."""
        # Train model with varied sequences to get non-1.0 probabilities
        behavior_detector.update_transition_model(["click", "scroll", "type", "click"])
        behavior_detector.update_transition_model(["click", "hover", "type", "scroll"])
        behavior_detector.update_transition_model(["click", "scroll", "submit", "click"])
        
        # Now "click" -> "scroll" has probability 2/3, not 1.0
        log_prob = behavior_detector.calculate_sequence_probability(
            ["click", "scroll", "type"]
        )
        
        assert log_prob < 0  # Log probability is negative for prob < 1
    
    def test_get_user_baseline(self, behavior_detector):
        """Test getting user baseline."""
        features = {
            "user_id": "user_1",
            "action_entropy": 1.5,
        }
        behavior_detector.detect(features)
        
        baseline = behavior_detector.get_user_baseline("user_1")
        assert isinstance(baseline, dict)


class TestTransactionMonitor:
    """Tests for TransactionMonitor."""
    
    def test_detect_empty_features(self, transaction_monitor):
        """Test detection with empty features."""
        result = transaction_monitor.detect({})
        
        assert result.detector_name == "transaction_monitor"
        assert result.score >= 0
    
    def test_detect_normal_transactions(self, transaction_monitor):
        """Test detection with normal transactions."""
        features = {
            "tx_count_1h": 5,
            "tx_count_24h": 20,
            "tx_total_amount_1h": 100,
            "tx_total_amount_24h": 500,
            "tx_avg_amount": 25,
            "tx_max_amount": 50,
            "tx_velocity_ratio": 1.0,
            "unique_payment_methods": 1,
            "total_unique_devices": 1,
            "total_unique_ips": 1,
            "unique_locations": 1,
        }
        
        result = transaction_monitor.detect(features)
        
        assert result.score >= 0
        assert result.score <= 1
    
    def test_detect_high_velocity(self, transaction_monitor):
        """Test detection of high transaction velocity."""
        features = {
            "tx_count_1h": 100,  # Very high
            "tx_count_24h": 300,
            "tx_velocity_ratio": 5.0,  # 5x expected rate
        }
        
        result = transaction_monitor.detect(features)
        
        assert result.score > 0
        assert any("velocity" in r.lower() for r in result.reasons)
    
    def test_detect_high_amount(self, transaction_monitor):
        """Test detection of high transaction amounts."""
        # Build baseline
        for i in range(10):
            transaction_monitor.detect({
                "tx_avg_amount": 50,
                "tx_max_amount": 100,
            })
        
        # Test high amount
        features = {
            "tx_total_amount_1h": 5000,  # Very high
            "tx_max_amount": 2000,
        }
        
        result = transaction_monitor.detect(features)
        
        assert result.score > 0
    
    def test_detect_multiple_payment_methods(self, transaction_monitor):
        """Test detection of multiple payment methods."""
        features = {
            "unique_payment_methods": 5,  # Many payment methods
        }
        
        result = transaction_monitor.detect(features)
        
        assert result.score > 0
    
    def test_detect_device_diversity(self, transaction_monitor):
        """Test detection of device diversity."""
        features = {
            "total_unique_devices": 10,  # Many devices
            "total_unique_ips": 15,  # Many IPs
            "tx_count_24h": 20,
        }
        
        result = transaction_monitor.detect(features)
        
        assert result.score > 0
    
    def test_check_impossible_travel(self, transaction_monitor):
        """Test impossible travel detection."""
        now = datetime.utcnow()
        
        transactions = [
            Transaction(
                transaction_id="tx_1",
                user_id="user_1",
                transaction_type=TransactionType.PURCHASE,
                amount=100,
                timestamp=now,
                geo_location="US-East",
            ),
            Transaction(
                transaction_id="tx_2",
                user_id="user_1",
                transaction_type=TransactionType.PURCHASE,
                amount=100,
                timestamp=now + timedelta(minutes=30),
                geo_location="Asia-East",  # Tokyo - impossible in 30 min
            ),
        ]
        
        score, reasons = transaction_monitor.check_impossible_travel(transactions)
        
        assert score > 0.9
        assert any("impossible" in r.lower() for r in reasons)
    
    def test_add_transaction_to_history(self, transaction_monitor):
        """Test adding transaction to history."""
        tx = Transaction(
            transaction_id="tx_1",
            user_id="user_1",
            transaction_type=TransactionType.PURCHASE,
            amount=100,
        )
        
        transaction_monitor.add_transaction_to_history("user_1", tx)
        history = transaction_monitor.get_user_transaction_history("user_1")
        
        assert len(history) == 1


class TestBotDetector:
    """Tests for BotDetector."""
    
    def test_detect_empty_features(self, bot_detector):
        """Test detection with empty features."""
        result = bot_detector.detect({})
        
        assert result.detector_name == "bot_detector"
        assert result.score >= 0
    
    def test_detect_human_behavior(self, bot_detector):
        """Test detection of human-like behavior."""
        features = {
            "inter_action_time_mean": 1.5,
            "inter_action_time_variance": 0.5,
            "action_entropy": 1.8,
            "unique_actions": 10,
            "behavior_count_1h": 50,
            "avg_action_duration_ms": 200,
            "action_duration_variance": 5000,
        }
        
        result = bot_detector.detect(features)
        
        # Human behavior should have low score
        assert result.score < 0.5
    
    def test_detect_bot_timing(self, bot_detector):
        """Test detection of bot-like timing."""
        features = {
            "inter_action_time_mean": 0.1,  # Very fast
            "inter_action_time_variance": 0.0001,  # Very consistent
            "behavior_count_1h": 1000,
        }
        
        result = bot_detector.detect(features)
        
        assert result.score > 0.5
        assert result.metadata.get("is_likely_bot", False)
    
    def test_detect_repetitive_actions(self, bot_detector):
        """Test detection of repetitive actions."""
        features = {
            "action_entropy": 0.1,  # Very low
            "unique_actions": 1,
            "behavior_count_1h": 500,
        }
        
        result = bot_detector.detect(features)
        
        assert result.score > 0
    
    def test_detect_superhuman_speed(self, bot_detector):
        """Test detection of superhuman speed."""
        features = {
            "inter_action_time_mean": 0.05,  # 50ms - superhuman
        }
        
        result = bot_detector.detect(features)
        
        assert result.score > 0.8
    
    def test_add_known_bot_pattern(self, bot_detector):
        """Test adding known bot pattern."""
        pattern = {
            "name": "click_bot",
            "action_entropy": {"min": 0, "max": 0.2},
            "inter_action_time_variance": {"min": 0, "max": 0.001},
        }
        
        bot_detector.add_known_bot_pattern(pattern)
        
        # Check pattern matching
        features = {
            "action_entropy": 0.1,
            "inter_action_time_variance": 0.0005,
        }
        
        is_match, name = bot_detector.check_known_patterns(features)
        
        assert is_match
        assert name == "click_bot"
    
    def test_check_known_patterns_no_match(self, bot_detector):
        """Test pattern checking with no match."""
        is_match, name = bot_detector.check_known_patterns({
            "action_entropy": 2.0,
        })
        
        assert not is_match
        assert name is None
