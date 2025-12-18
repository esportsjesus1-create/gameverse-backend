"""Pytest configuration and fixtures for fraud-ml tests."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.fraud_ml.engine.fraud_engine import FraudEngine
from app.fraud_ml.engine.base import DetectorRegistry
from app.fraud_ml.engine.feature_extractor import FeatureExtractor
from app.fraud_ml.engine.scoring_engine import ScoringEngine
from app.fraud_ml.detectors.anomaly_detector import AnomalyDetector
from app.fraud_ml.detectors.behavior_detector import BehaviorPatternDetector
from app.fraud_ml.detectors.transaction_detector import TransactionMonitor
from app.fraud_ml.detectors.bot_detector import BotDetector
from app.fraud_ml.detectors.flagging import AutomatedFlagger, FlagStore
from app.fraud_ml.models.schemas import (
    UserEvent,
    Transaction,
    BehaviorEvent,
    EventType,
    TransactionType,
)


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def fraud_engine():
    """Create a fresh fraud engine instance."""
    return FraudEngine()


@pytest.fixture
def detector_registry():
    """Create a fresh detector registry."""
    return DetectorRegistry()


@pytest.fixture
def feature_extractor():
    """Create a fresh feature extractor."""
    return FeatureExtractor()


@pytest.fixture
def scoring_engine(detector_registry):
    """Create a scoring engine with registry."""
    return ScoringEngine(registry=detector_registry)


@pytest.fixture
def anomaly_detector():
    """Create an anomaly detector."""
    return AnomalyDetector()


@pytest.fixture
def behavior_detector():
    """Create a behavior pattern detector."""
    return BehaviorPatternDetector()


@pytest.fixture
def transaction_monitor():
    """Create a transaction monitor."""
    return TransactionMonitor()


@pytest.fixture
def bot_detector():
    """Create a bot detector."""
    return BotDetector()


@pytest.fixture
def flag_store():
    """Create a flag store."""
    return FlagStore()


@pytest.fixture
def flagger(flag_store):
    """Create an automated flagger."""
    return AutomatedFlagger(flag_store=flag_store)


@pytest.fixture
def sample_user_event():
    """Create a sample user event."""
    return UserEvent(
        event_id=str(uuid4()),
        user_id="test_user_1",
        event_type=EventType.LOGIN,
        timestamp=datetime.utcnow(),
        session_id="session_1",
        device_id="device_1",
        ip_address="192.168.1.1",
        geo_location="US-East",
    )


@pytest.fixture
def sample_transaction():
    """Create a sample transaction."""
    return Transaction(
        transaction_id=str(uuid4()),
        user_id="test_user_1",
        transaction_type=TransactionType.PURCHASE,
        amount=99.99,
        currency="USD",
        timestamp=datetime.utcnow(),
        payment_method="credit_card",
        device_id="device_1",
        ip_address="192.168.1.1",
        geo_location="US-East",
    )


@pytest.fixture
def sample_behavior_event():
    """Create a sample behavior event."""
    return BehaviorEvent(
        event_id=str(uuid4()),
        user_id="test_user_1",
        action="click",
        timestamp=datetime.utcnow(),
        session_id="session_1",
        duration_ms=150,
        input_type="mouse",
    )


@pytest.fixture
def sample_events_batch():
    """Create a batch of sample events."""
    base_time = datetime.utcnow()
    events = []
    for i in range(20):
        events.append(UserEvent(
            event_id=str(uuid4()),
            user_id="test_user_1",
            event_type=EventType.GAMEPLAY,
            timestamp=base_time + timedelta(minutes=i),
            session_id="session_1",
            device_id="device_1",
            ip_address="192.168.1.1",
        ))
    return events


@pytest.fixture
def sample_transactions_batch():
    """Create a batch of sample transactions."""
    base_time = datetime.utcnow()
    transactions = []
    for i in range(10):
        transactions.append(Transaction(
            transaction_id=str(uuid4()),
            user_id="test_user_1",
            transaction_type=TransactionType.PURCHASE,
            amount=10.0 + i * 5,
            timestamp=base_time + timedelta(minutes=i * 5),
            payment_method="credit_card",
            device_id="device_1",
        ))
    return transactions


@pytest.fixture
def sample_behavior_batch():
    """Create a batch of sample behavior events."""
    base_time = datetime.utcnow()
    events = []
    actions = ["click", "scroll", "type", "hover", "click"]
    for i in range(50):
        events.append(BehaviorEvent(
            event_id=str(uuid4()),
            user_id="test_user_1",
            action=actions[i % len(actions)],
            timestamp=base_time + timedelta(seconds=i * 2),
            session_id="session_1",
            duration_ms=100 + (i % 10) * 20,
        ))
    return events
