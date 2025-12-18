import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_database


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_database():
    db = get_database()
    db.reset()
    yield
    db.reset()
