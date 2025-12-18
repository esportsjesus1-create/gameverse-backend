import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.dev_portal.database import Base, get_db
from app.dev_portal.utils.security import get_password_hash, create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(db_session):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_developer(db_session):
    from app.dev_portal.models.developer import Developer, DeveloperTier
    
    developer = Developer(
        email="test@example.com",
        username="testdev",
        hashed_password=get_password_hash("testpassword123"),
        company_name="Test Company",
        tier=DeveloperTier.FREE,
        is_active=True,
        is_verified=True
    )
    db_session.add(developer)
    db_session.commit()
    db_session.refresh(developer)
    return developer


@pytest.fixture
def pro_developer(db_session):
    from app.dev_portal.models.developer import Developer, DeveloperTier
    
    developer = Developer(
        email="pro@example.com",
        username="prodev",
        hashed_password=get_password_hash("testpassword123"),
        company_name="Pro Company",
        tier=DeveloperTier.PRO,
        is_active=True,
        is_verified=True
    )
    db_session.add(developer)
    db_session.commit()
    db_session.refresh(developer)
    return developer


@pytest.fixture
def enterprise_developer(db_session):
    from app.dev_portal.models.developer import Developer, DeveloperTier
    
    developer = Developer(
        email="enterprise@example.com",
        username="enterprisedev",
        hashed_password=get_password_hash("testpassword123"),
        company_name="Enterprise Company",
        tier=DeveloperTier.ENTERPRISE,
        is_active=True,
        is_verified=True
    )
    db_session.add(developer)
    db_session.commit()
    db_session.refresh(developer)
    return developer


@pytest.fixture
def auth_headers(test_developer):
    token = create_access_token(data={"sub": test_developer.id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pro_auth_headers(pro_developer):
    token = create_access_token(data={"sub": pro_developer.id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def enterprise_auth_headers(enterprise_developer):
    token = create_access_token(data={"sub": enterprise_developer.id})
    return {"Authorization": f"Bearer {token}"}
