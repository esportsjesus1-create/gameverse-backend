"""Pytest configuration and fixtures for GameVerse recommendation module tests."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.memory_db import reset_database, get_database


@pytest.fixture(autouse=True)
def reset_db():
    """Reset database before each test."""
    reset_database()
    yield
    reset_database()


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def db():
    """Get a fresh database instance."""
    return get_database()
