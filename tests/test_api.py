"""Tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.fraud_ml.api.routes import get_fraud_engine


@pytest.fixture(autouse=True)
def reset_fraud_engine():
    """Reset the fraud engine before each test."""
    import app.fraud_ml.api.routes as routes
    routes._fraud_engine = None
    yield
    routes._fraud_engine = None


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    def test_healthz(self, client):
        """Test health check endpoint."""
        response = client.get("/healthz")
        
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_root(self, client):
        """Test root endpoint."""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "GameVerse Backend"
        assert data["version"] == "1.44.0"
        assert "anomaly_detection" in data["features"]


class TestEventEndpoints:
    """Tests for event submission endpoints."""
    
    def test_submit_event(self, client):
        """Test submitting a user event."""
        response = client.post(
            "/api/v1/fraud/events",
            json={
                "user_id": "test_user_1",
                "event_type": "login",
                "session_id": "session_1",
                "device_id": "device_1",
                "ip_address": "192.168.1.1",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "fraud_score" in data
        assert data["fraud_score"]["entity_id"] == "test_user_1"
    
    def test_submit_event_minimal(self, client):
        """Test submitting event with minimal data."""
        response = client.post(
            "/api/v1/fraud/events",
            json={
                "user_id": "test_user_1",
                "event_type": "gameplay",
            }
        )
        
        assert response.status_code == 200
    
    def test_submit_event_invalid(self, client):
        """Test submitting invalid event."""
        response = client.post(
            "/api/v1/fraud/events",
            json={
                "user_id": "test_user_1",
                "event_type": "invalid_type",
            }
        )
        
        assert response.status_code == 422


class TestTransactionEndpoints:
    """Tests for transaction endpoints."""
    
    def test_submit_transaction(self, client):
        """Test submitting a transaction."""
        response = client.post(
            "/api/v1/fraud/transactions",
            json={
                "user_id": "test_user_1",
                "transaction_type": "purchase",
                "amount": 99.99,
                "currency": "USD",
                "payment_method": "credit_card",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "fraud_score" in data
        assert data["fraud_score"]["entity_type"] == "transaction"
    
    def test_submit_transaction_minimal(self, client):
        """Test submitting transaction with minimal data."""
        response = client.post(
            "/api/v1/fraud/transactions",
            json={
                "user_id": "test_user_1",
                "transaction_type": "purchase",
                "amount": 10.0,
            }
        )
        
        assert response.status_code == 200
    
    def test_submit_transaction_negative_amount(self, client):
        """Test submitting transaction with negative amount."""
        response = client.post(
            "/api/v1/fraud/transactions",
            json={
                "user_id": "test_user_1",
                "transaction_type": "purchase",
                "amount": -10.0,
            }
        )
        
        assert response.status_code == 422


class TestBehaviorEndpoints:
    """Tests for behavior event endpoints."""
    
    def test_submit_behavior(self, client):
        """Test submitting a behavior event."""
        response = client.post(
            "/api/v1/fraud/behavior",
            json={
                "user_id": "test_user_1",
                "action": "click",
                "session_id": "session_1",
                "duration_ms": 150,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "fraud_score" in data
    
    def test_submit_behavior_batch(self, client):
        """Test submitting batch of behavior events."""
        response = client.post(
            "/api/v1/fraud/behavior/batch",
            json={
                "user_id": "test_user_1",
                "events": [
                    {"user_id": "test_user_1", "action": "click", "duration_ms": 100},
                    {"user_id": "test_user_1", "action": "scroll", "duration_ms": 200},
                    {"user_id": "test_user_1", "action": "type", "duration_ms": 500},
                ]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["fraud_score"]["entity_type"] == "user_behavior"


class TestAnalysisEndpoints:
    """Tests for analysis endpoints."""
    
    def test_analyze_user(self, client):
        """Test analyzing a user."""
        # First submit some events
        client.post(
            "/api/v1/fraud/events",
            json={"user_id": "test_user_1", "event_type": "login"}
        )
        
        response = client.post(
            "/api/v1/fraud/analyze",
            json={"user_id": "test_user_1"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["fraud_score"]["entity_id"] == "test_user_1"
    
    def test_get_user_risk(self, client):
        """Test getting user risk history."""
        # Submit some data first
        client.post(
            "/api/v1/fraud/events",
            json={"user_id": "test_user_1", "event_type": "login"}
        )
        
        response = client.get("/api/v1/fraud/users/test_user_1/risk")
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "test_user_1"
        assert "event_count" in data
    
    def test_check_user_blocked(self, client):
        """Test checking if user is blocked."""
        response = client.get("/api/v1/fraud/users/test_user_1/blocked")
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "test_user_1"
        assert data["is_blocked"] is False


class TestFlagEndpoints:
    """Tests for flag management endpoints."""
    
    def test_get_user_flags(self, client):
        """Test getting user flags."""
        response = client.get("/api/v1/fraud/users/test_user_1/flags")
        
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_manual_flag(self, client):
        """Test creating a manual flag."""
        response = client.post(
            "/api/v1/fraud/flags/manual",
            json={
                "entity_id": "test_user_1",
                "action": "block",
                "reason": "Suspicious activity",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["entity_id"] == "test_user_1"
        assert data["action"] == "block"
    
    def test_remove_block(self, client):
        """Test removing a block."""
        # First create a block
        client.post(
            "/api/v1/fraud/flags/manual",
            json={
                "entity_id": "test_user_1",
                "action": "block",
                "reason": "Test block",
            }
        )
        
        response = client.delete("/api/v1/fraud/flags/test_user_1/block")
        
        assert response.status_code == 200
        data = response.json()
        assert data["block_removed"] is True
    
    def test_get_recent_flags(self, client):
        """Test getting recent flags."""
        response = client.get("/api/v1/fraud/flags/recent?hours=24&limit=10")
        
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_active_blocks(self, client):
        """Test getting active blocks."""
        response = client.get("/api/v1/fraud/flags/blocks")
        
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestConfigEndpoints:
    """Tests for configuration endpoints."""
    
    def test_configure_detector(self, client):
        """Test configuring a detector."""
        response = client.post(
            "/api/v1/fraud/config/detector",
            json={
                "detector_name": "anomaly_detector",
                "weight": 2.0,
                "enabled": True,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is True
    
    def test_configure_nonexistent_detector(self, client):
        """Test configuring nonexistent detector."""
        response = client.post(
            "/api/v1/fraud/config/detector",
            json={
                "detector_name": "nonexistent",
                "weight": 1.0,
            }
        )
        
        assert response.status_code == 404
    
    def test_get_thresholds(self, client):
        """Test getting thresholds."""
        response = client.get("/api/v1/fraud/config/thresholds")
        
        assert response.status_code == 200
        data = response.json()
        assert "scoring_thresholds" in data
        assert "flagging_thresholds" in data


class TestStatisticsEndpoints:
    """Tests for statistics endpoints."""
    
    def test_get_statistics(self, client):
        """Test getting engine statistics."""
        response = client.get("/api/v1/fraud/statistics")
        
        assert response.status_code == 200
        data = response.json()
        assert "detectors" in data
        assert "storage" in data
        assert "flagging" in data


class TestDataManagement:
    """Tests for data management endpoints."""
    
    def test_clear_user_data(self, client):
        """Test clearing user data."""
        # First add some data
        client.post(
            "/api/v1/fraud/events",
            json={"user_id": "test_user_1", "event_type": "login"}
        )
        
        response = client.delete("/api/v1/fraud/users/test_user_1/data")
        
        assert response.status_code == 200
        data = response.json()
        assert data["data_cleared"] is True
        
        # Verify data is cleared
        risk = client.get("/api/v1/fraud/users/test_user_1/risk").json()
        assert risk["event_count"] == 0
