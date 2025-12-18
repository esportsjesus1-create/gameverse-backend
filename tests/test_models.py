"""Tests for data models and schemas."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from app.fraud_ml.models.schemas import (
    UserEvent,
    Transaction,
    BehaviorEvent,
    DetectorResult,
    FraudScore,
    FlagDecision,
    RiskLevel,
    FlagAction,
    EventType,
    TransactionType,
)


class TestUserEvent:
    """Tests for UserEvent model."""
    
    def test_create_user_event(self):
        """Test creating a user event."""
        event = UserEvent(
            event_id="event_1",
            user_id="user_1",
            event_type=EventType.LOGIN,
        )
        
        assert event.event_id == "event_1"
        assert event.user_id == "user_1"
        assert event.event_type == EventType.LOGIN
        assert event.timestamp is not None
    
    def test_user_event_with_all_fields(self):
        """Test user event with all optional fields."""
        event = UserEvent(
            event_id="event_1",
            user_id="user_1",
            event_type=EventType.PURCHASE,
            session_id="session_1",
            device_id="device_1",
            ip_address="192.168.1.1",
            geo_location="US-East",
            metadata={"item": "sword"},
        )
        
        assert event.session_id == "session_1"
        assert event.device_id == "device_1"
        assert event.ip_address == "192.168.1.1"
        assert event.geo_location == "US-East"
        assert event.metadata["item"] == "sword"


class TestTransaction:
    """Tests for Transaction model."""
    
    def test_create_transaction(self):
        """Test creating a transaction."""
        tx = Transaction(
            transaction_id="tx_1",
            user_id="user_1",
            transaction_type=TransactionType.PURCHASE,
            amount=99.99,
        )
        
        assert tx.transaction_id == "tx_1"
        assert tx.user_id == "user_1"
        assert tx.amount == 99.99
        assert tx.currency == "USD"
    
    def test_transaction_negative_amount(self):
        """Test transaction with negative amount."""
        with pytest.raises(ValueError):
            Transaction(
                transaction_id="tx_1",
                user_id="user_1",
                transaction_type=TransactionType.PURCHASE,
                amount=-10.0,
            )
    
    def test_transaction_with_recipient(self):
        """Test transaction with recipient (trade/gift)."""
        tx = Transaction(
            transaction_id="tx_1",
            user_id="user_1",
            transaction_type=TransactionType.GIFT,
            amount=50.0,
            recipient_id="user_2",
        )
        
        assert tx.recipient_id == "user_2"


class TestBehaviorEvent:
    """Tests for BehaviorEvent model."""
    
    def test_create_behavior_event(self):
        """Test creating a behavior event."""
        event = BehaviorEvent(
            event_id="be_1",
            user_id="user_1",
            action="click",
        )
        
        assert event.event_id == "be_1"
        assert event.action == "click"
    
    def test_behavior_event_with_duration(self):
        """Test behavior event with duration."""
        event = BehaviorEvent(
            event_id="be_1",
            user_id="user_1",
            action="type",
            duration_ms=500,
        )
        
        assert event.duration_ms == 500
    
    def test_behavior_event_negative_duration(self):
        """Test behavior event with negative duration."""
        with pytest.raises(ValueError):
            BehaviorEvent(
                event_id="be_1",
                user_id="user_1",
                action="click",
                duration_ms=-100,
            )


class TestDetectorResult:
    """Tests for DetectorResult model."""
    
    def test_create_detector_result(self):
        """Test creating a detector result."""
        result = DetectorResult(
            detector_name="anomaly_detector",
            score=0.75,
            confidence=0.9,
            reasons=["High velocity detected"],
        )
        
        assert result.detector_name == "anomaly_detector"
        assert result.score == 0.75
        assert result.confidence == 0.9
        assert len(result.reasons) == 1
    
    def test_detector_result_score_bounds(self):
        """Test detector result score bounds."""
        with pytest.raises(ValueError):
            DetectorResult(
                detector_name="test",
                score=1.5,  # > 1
                confidence=0.5,
            )
        
        with pytest.raises(ValueError):
            DetectorResult(
                detector_name="test",
                score=-0.1,  # < 0
                confidence=0.5,
            )


class TestFraudScore:
    """Tests for FraudScore model."""
    
    def test_create_fraud_score(self):
        """Test creating a fraud score."""
        score = FraudScore(
            entity_id="user_1",
            overall_score=0.65,
            risk_level=RiskLevel.HIGH,
        )
        
        assert score.entity_id == "user_1"
        assert score.overall_score == 0.65
        assert score.risk_level == RiskLevel.HIGH
        assert score.entity_type == "user"
    
    def test_fraud_score_with_detectors(self):
        """Test fraud score with detector results."""
        detector_results = [
            DetectorResult(
                detector_name="anomaly",
                score=0.7,
                confidence=0.8,
            ),
            DetectorResult(
                detector_name="bot",
                score=0.3,
                confidence=0.9,
            ),
        ]
        
        score = FraudScore(
            entity_id="user_1",
            overall_score=0.5,
            risk_level=RiskLevel.MEDIUM,
            detector_results=detector_results,
        )
        
        assert len(score.detector_results) == 2


class TestFlagDecision:
    """Tests for FlagDecision model."""
    
    def test_create_flag_decision(self):
        """Test creating a flag decision."""
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
        )
        
        assert flag.flag_id == "flag_1"
        assert flag.action == FlagAction.REVIEW
        assert flag.risk_score == 0.5
    
    def test_flag_decision_with_expiration(self):
        """Test flag decision with expiration."""
        expires = datetime.utcnow() + timedelta(hours=24)
        
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
            expires_at=expires,
        )
        
        assert flag.expires_at == expires
    
    def test_flag_decision_with_reasons(self):
        """Test flag decision with reasons."""
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.SUSPEND,
            risk_score=0.95,
            risk_level=RiskLevel.CRITICAL,
            triggered_detectors=["bot_detector", "anomaly_detector"],
            reasons=["Bot-like behavior", "Impossible travel"],
        )
        
        assert len(flag.triggered_detectors) == 2
        assert len(flag.reasons) == 2


class TestEnums:
    """Tests for enum types."""
    
    def test_risk_levels(self):
        """Test risk level enum values."""
        assert RiskLevel.LOW.value == "low"
        assert RiskLevel.MEDIUM.value == "medium"
        assert RiskLevel.HIGH.value == "high"
        assert RiskLevel.CRITICAL.value == "critical"
    
    def test_flag_actions(self):
        """Test flag action enum values."""
        assert FlagAction.ALLOW.value == "allow"
        assert FlagAction.REVIEW.value == "review"
        assert FlagAction.BLOCK.value == "block"
        assert FlagAction.SUSPEND.value == "suspend"
    
    def test_event_types(self):
        """Test event type enum values."""
        assert EventType.LOGIN.value == "login"
        assert EventType.PURCHASE.value == "purchase"
        assert EventType.GAMEPLAY.value == "gameplay"
    
    def test_transaction_types(self):
        """Test transaction type enum values."""
        assert TransactionType.PURCHASE.value == "purchase"
        assert TransactionType.TRADE.value == "trade"
        assert TransactionType.GIFT.value == "gift"
