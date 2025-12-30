import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.main import app
from app.analytics.services.database import db


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_database():
    """Clear the database before each test."""
    db.clear()
    yield
    db.clear()


@pytest.fixture
def sample_player_data():
    """Sample player data for testing."""
    return {
        "username": "test_player",
        "email": "test@example.com",
        "country": "US",
        "platform": "iOS",
        "device_type": "iPhone",
        "app_version": "1.0.0",
    }


@pytest.fixture
def sample_event_data():
    """Sample event data for testing."""
    return {
        "player_id": "test-player-id",
        "event_type": "session_start",
        "event_name": "game_start",
        "properties": {"level": 1},
        "value": 0,
    }


@pytest.fixture
def sample_session_data():
    """Sample session data for testing."""
    return {
        "player_id": "test-player-id",
        "platform": "iOS",
        "device_type": "iPhone",
        "app_version": "1.0.0",
        "country": "US",
    }


@pytest.fixture
def sample_experiment_data():
    """Sample experiment data for testing."""
    return {
        "name": "Button Color Test",
        "description": "Testing button color impact on conversion",
        "hypothesis": "Red buttons will increase conversion by 10%",
        "primary_metric": "conversion_rate",
        "secondary_metrics": ["click_rate", "time_to_convert"],
        "target_sample_size": 1000,
        "minimum_detectable_effect": 0.1,
        "variants": [
            {
                "name": "Control",
                "description": "Blue button",
                "weight": 1.0,
                "config": {"button_color": "blue"},
            },
            {
                "name": "Treatment",
                "description": "Red button",
                "weight": 1.0,
                "config": {"button_color": "red"},
            },
        ],
    }


@pytest.fixture
def sample_funnel_data():
    """Sample funnel data for testing."""
    return {
        "name": "Onboarding Funnel",
        "description": "Track user onboarding flow",
        "steps": [
            {
                "name": "Tutorial Start",
                "event_type": "tutorial_start",
                "event_name": "tutorial_begin",
                "order": 0,
            },
            {
                "name": "Tutorial Complete",
                "event_type": "tutorial_complete",
                "event_name": "tutorial_finish",
                "order": 1,
            },
            {
                "name": "First Purchase",
                "event_type": "purchase",
                "event_name": "first_purchase",
                "order": 2,
            },
        ],
    }


@pytest.fixture
def created_player(client, sample_player_data):
    """Create a player and return the response."""
    response = client.post("/api/v1/analytics/players/", json=sample_player_data)
    return response.json()


@pytest.fixture
def created_session(client, created_player):
    """Create a session for a player."""
    session_data = {
        "player_id": created_player["id"],
        "platform": "iOS",
        "device_type": "iPhone",
        "app_version": "1.0.0",
        "country": "US",
    }
    response = client.post("/api/v1/analytics/sessions/", json=session_data)
    return response.json()
