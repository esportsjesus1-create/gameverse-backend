"""Tests for automated flagging module."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from app.fraud_ml.detectors.flagging import (
    FlagStore,
    AutomatedFlagger,
    create_manual_flag,
)
from app.fraud_ml.models.schemas import (
    FlagAction,
    FlagDecision,
    FraudScore,
    DetectorResult,
    RiskLevel,
)


class TestFlagStore:
    """Tests for FlagStore."""
    
    def test_add_flag(self, flag_store):
        """Test adding a flag."""
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
        )
        
        flag_store.add_flag(flag)
        
        retrieved = flag_store.get_flag("flag_1")
        assert retrieved is not None
        assert retrieved.flag_id == "flag_1"
    
    def test_get_entity_flags(self, flag_store):
        """Test getting flags for an entity."""
        flag1 = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
        )
        flag2 = FlagDecision(
            flag_id="flag_2",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
        )
        
        flag_store.add_flag(flag1)
        flag_store.add_flag(flag2)
        
        flags = flag_store.get_entity_flags("user_1")
        assert len(flags) == 2
    
    def test_get_entity_flags_exclude_expired(self, flag_store):
        """Test excluding expired flags."""
        expired_flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
            expires_at=datetime.utcnow() - timedelta(hours=1),  # Expired
        )
        active_flag = FlagDecision(
            flag_id="flag_2",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
            expires_at=datetime.utcnow() + timedelta(hours=24),  # Active
        )
        
        flag_store.add_flag(expired_flag)
        flag_store.add_flag(active_flag)
        
        flags = flag_store.get_entity_flags("user_1", include_expired=False)
        assert len(flags) == 1
        assert flags[0].flag_id == "flag_2"
    
    def test_is_blocked(self, flag_store):
        """Test checking if entity is blocked."""
        assert not flag_store.is_blocked("user_1")
        
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
        )
        flag_store.add_flag(flag)
        
        assert flag_store.is_blocked("user_1")
    
    def test_is_blocked_expired(self, flag_store):
        """Test blocked status with expired flag."""
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
            expires_at=datetime.utcnow() - timedelta(hours=1),  # Expired
        )
        flag_store.add_flag(flag)
        
        assert not flag_store.is_blocked("user_1")
    
    def test_remove_block(self, flag_store):
        """Test removing a block."""
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
        )
        flag_store.add_flag(flag)
        
        assert flag_store.is_blocked("user_1")
        
        removed = flag_store.remove_block("user_1")
        assert removed
        assert not flag_store.is_blocked("user_1")
    
    def test_remove_nonexistent_block(self, flag_store):
        """Test removing nonexistent block."""
        removed = flag_store.remove_block("user_1")
        assert not removed
    
    def test_get_active_blocks(self, flag_store):
        """Test getting all active blocks."""
        flag1 = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
        )
        flag2 = FlagDecision(
            flag_id="flag_2",
            entity_id="user_2",
            action=FlagAction.SUSPEND,
            risk_score=0.9,
            risk_level=RiskLevel.CRITICAL,
        )
        
        flag_store.add_flag(flag1)
        flag_store.add_flag(flag2)
        
        blocks = flag_store.get_active_blocks()
        assert len(blocks) == 2
    
    def test_get_flags_by_action(self, flag_store):
        """Test getting flags by action type."""
        flag1 = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
        )
        flag2 = FlagDecision(
            flag_id="flag_2",
            entity_id="user_2",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
        )
        
        flag_store.add_flag(flag1)
        flag_store.add_flag(flag2)
        
        review_flags = flag_store.get_flags_by_action(FlagAction.REVIEW)
        assert len(review_flags) == 1
        assert review_flags[0].flag_id == "flag_1"
    
    def test_get_recent_flags(self, flag_store):
        """Test getting recent flags."""
        for i in range(5):
            flag = FlagDecision(
                flag_id=f"flag_{i}",
                entity_id=f"user_{i}",
                action=FlagAction.REVIEW,
                risk_score=0.5,
                risk_level=RiskLevel.MEDIUM,
            )
            flag_store.add_flag(flag)
        
        recent = flag_store.get_recent_flags(hours=24, limit=3)
        assert len(recent) == 3
    
    def test_clear_expired(self, flag_store):
        """Test clearing expired flags."""
        expired = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        active = FlagDecision(
            flag_id="flag_2",
            entity_id="user_2",
            action=FlagAction.REVIEW,
            risk_score=0.5,
            risk_level=RiskLevel.MEDIUM,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        
        flag_store.add_flag(expired)
        flag_store.add_flag(active)
        
        cleared = flag_store.clear_expired()
        assert cleared == 1
    
    def test_get_statistics(self, flag_store):
        """Test getting flag store statistics."""
        flag = FlagDecision(
            flag_id="flag_1",
            entity_id="user_1",
            action=FlagAction.BLOCK,
            risk_score=0.8,
            risk_level=RiskLevel.HIGH,
        )
        flag_store.add_flag(flag)
        
        stats = flag_store.get_statistics()
        
        assert stats["total_flags"] == 1
        assert stats["active_blocks"] == 1
        assert "by_action" in stats
        assert "by_risk_level" in stats


class TestAutomatedFlagger:
    """Tests for AutomatedFlagger."""
    
    def test_evaluate_low_risk(self, flagger):
        """Test evaluation of low risk score."""
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.1,
            risk_level=RiskLevel.LOW,
            detector_results=[],
        )
        
        flag = flagger.evaluate(fraud_score)
        
        assert flag.action == FlagAction.ALLOW
    
    def test_evaluate_medium_risk(self, flagger):
        """Test evaluation of medium risk score."""
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.5,
            risk_level=RiskLevel.MEDIUM,
            detector_results=[
                DetectorResult(
                    detector_name="test",
                    score=0.5,
                    confidence=0.8,
                    reasons=["Test reason"],
                )
            ],
        )
        
        flag = flagger.evaluate(fraud_score)
        
        assert flag.action == FlagAction.REVIEW
    
    def test_evaluate_high_risk(self, flagger):
        """Test evaluation of high risk score."""
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.8,
            risk_level=RiskLevel.HIGH,
            detector_results=[
                DetectorResult(
                    detector_name="anomaly",
                    score=0.8,
                    confidence=0.9,
                    reasons=["High anomaly"],
                )
            ],
        )
        
        flag = flagger.evaluate(fraud_score)
        
        assert flag.action == FlagAction.BLOCK
    
    def test_evaluate_critical_risk(self, flagger):
        """Test evaluation of critical risk score."""
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.95,
            risk_level=RiskLevel.CRITICAL,
            detector_results=[
                DetectorResult(
                    detector_name="bot",
                    score=0.95,
                    confidence=0.95,
                    reasons=["Bot detected"],
                )
            ],
        )
        
        flag = flagger.evaluate(fraud_score)
        
        assert flag.action == FlagAction.SUSPEND
    
    def test_evaluate_auto_flag(self, flagger, flag_store):
        """Test auto-flagging stores flag."""
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.8,
            risk_level=RiskLevel.HIGH,
            detector_results=[],
        )
        
        flag = flagger.evaluate(fraud_score, auto_flag=True)
        
        stored = flag_store.get_flag(flag.flag_id)
        assert stored is not None
    
    def test_evaluate_no_auto_flag(self, flagger, flag_store):
        """Test evaluation without auto-flagging."""
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.8,
            risk_level=RiskLevel.HIGH,
            detector_results=[],
        )
        
        flag = flagger.evaluate(fraud_score, auto_flag=False)
        
        stored = flag_store.get_flag(flag.flag_id)
        assert stored is None
    
    def test_set_threshold(self, flagger):
        """Test setting action threshold."""
        flagger.set_threshold(FlagAction.BLOCK, 0.9)
        thresholds = flagger.get_thresholds()
        
        assert thresholds[FlagAction.BLOCK] == 0.9
    
    def test_set_expiration(self, flagger):
        """Test setting action expiration."""
        flagger.set_expiration(FlagAction.BLOCK, 48)
        
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.8,
            risk_level=RiskLevel.HIGH,
            detector_results=[],
        )
        
        flag = flagger.evaluate(fraud_score)
        
        assert flag.expires_at is not None
    
    def test_add_detector_rule(self, flagger):
        """Test adding detector-specific rule."""
        flagger.add_detector_rule(
            detector_name="bot_detector",
            escalate_threshold=0.7,
            escalate_to="suspend",
        )
        
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.5,  # Would normally be REVIEW
            risk_level=RiskLevel.MEDIUM,
            detector_results=[
                DetectorResult(
                    detector_name="bot_detector",
                    score=0.8,  # Above escalate threshold
                    confidence=0.9,
                    reasons=["Bot detected"],
                )
            ],
        )
        
        flag = flagger.evaluate(fraud_score)
        
        # Should be escalated to SUSPEND
        assert flag.action == FlagAction.SUSPEND
    
    def test_remove_detector_rule(self, flagger):
        """Test removing detector rule."""
        flagger.add_detector_rule("test", 0.5, "block")
        removed = flagger.remove_detector_rule("test")
        
        assert removed
        
        removed_again = flagger.remove_detector_rule("test")
        assert not removed_again
    
    def test_register_callback(self, flagger):
        """Test registering flag callback."""
        callback_called = []
        
        def callback(flag):
            callback_called.append(flag)
        
        flagger.register_callback(callback)
        
        fraud_score = FraudScore(
            entity_id="user_1",
            overall_score=0.5,
            risk_level=RiskLevel.MEDIUM,
            detector_results=[],
        )
        
        flagger.evaluate(fraud_score)
        
        assert len(callback_called) == 1
    
    def test_get_statistics(self, flagger):
        """Test getting flagger statistics."""
        stats = flagger.get_statistics()
        
        assert "thresholds" in stats
        assert "expirations" in stats
        assert "flag_store" in stats


class TestCreateManualFlag:
    """Tests for create_manual_flag function."""
    
    def test_create_manual_flag_basic(self):
        """Test creating a basic manual flag."""
        flag = create_manual_flag(
            entity_id="user_1",
            action=FlagAction.BLOCK,
            reason="Suspicious activity reported",
        )
        
        assert flag.entity_id == "user_1"
        assert flag.action == FlagAction.BLOCK
        assert "Suspicious activity reported" in flag.reasons
        assert flag.metadata.get("manual") is True
    
    def test_create_manual_flag_with_expiration(self):
        """Test creating manual flag with expiration."""
        flag = create_manual_flag(
            entity_id="user_1",
            action=FlagAction.SUSPEND,
            reason="Account under investigation",
            expires_hours=72,
        )
        
        assert flag.expires_at is not None
        assert flag.expires_at > datetime.utcnow()
    
    def test_create_manual_flag_entity_type(self):
        """Test creating manual flag with custom entity type."""
        flag = create_manual_flag(
            entity_id="device_123",
            action=FlagAction.BLOCK,
            reason="Compromised device",
            entity_type="device",
        )
        
        assert flag.entity_type == "device"
