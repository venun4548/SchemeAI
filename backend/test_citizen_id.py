import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db
from app.models.models import User
from app.core.security import generate_citizen_id

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_generate_citizen_id_format(db_session):
    """Test that the generated Citizen ID has the correct format."""
    citizen_id = generate_citizen_id(db_session)
    assert citizen_id.startswith("SCAI-CIT-")
    assert len(citizen_id) == 18
    # Ensure characters after prefix are uppercase alphanumeric
    suffix = citizen_id[9:]
    assert suffix.isalnum()
    assert suffix.isupper()

def test_new_user_registration_generates_id(db_session):
    """Test that registering a new user automatically assigns a Citizen ID."""
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": "Test Citizen",
            "email": "testcit@example.com",
            "password": "securepassword123",
            "phone": "9876543210"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "citizen_id" in data["user"]
    assert data["user"]["citizen_id"].startswith("SCAI-CIT-")

    # Verify in DB
    user = db_session.query(User).filter_by(email="testcit@example.com").first()
    assert user is not None
    assert user.citizen_id == data["user"]["citizen_id"]

def test_duplicate_prevention(db_session, monkeypatch):
    """Test that duplicate Citizen IDs are prevented and regenerated."""
    # Mock secrets.choice to always return 'A' initially, then 'B'
    choices = ['A'] * 8 + ['B'] * 8
    
    import secrets
    original_choice = secrets.choice
    
    def mock_choice(seq):
        if choices:
            return choices.pop(0)
        return original_choice(seq)

    monkeypatch.setattr(secrets, "choice", mock_choice)

    # First ID should be SCAI-CIT-AAAAAAAA
    id1 = generate_citizen_id(db_session)
    assert id1 == "SCAI-CIT-AAAAAAAA"
    
    # Save a user with this ID to simulate collision
    user1 = User(email="user1@test.com", password_hash="hash", full_name="User 1", citizen_id=id1)
    db_session.add(user1)
    db_session.commit()

    # Second ID generation should collide on 'A', loop, and return 'B's
    id2 = generate_citizen_id(db_session)
    assert id2 == "SCAI-CIT-BBBBBBBB"

def test_admin_search(db_session):
    """Test that admin search finds a user by exact Citizen ID or partial details."""
    # Insert test users
    id1 = generate_citizen_id(db_session)
    u1 = User(email="findme@test.com", phone="111222333", full_name="Alpha Bravo", password_hash="hash", citizen_id=id1, role="citizen")
    
    id2 = generate_citizen_id(db_session)
    u2 = User(email="hidden@test.com", phone="444555666", full_name="Charlie Delta", password_hash="hash", citizen_id=id2, role="citizen")

    # Admin user to bypass permissions
    admin_u = User(email="admin@test.com", password_hash="hash", full_name="Admin", role="admin", admin_role="super_admin")
    
    db_session.add_all([u1, u2, admin_u])
    db_session.commit()

    from app.core.security import create_access_token
    token = create_access_token(admin_u)
    headers = {"Authorization": f"Bearer {token}"}

    # Search by Citizen ID
    res1 = client.get(f"/api/admin/users?search={id1}", headers=headers)
    assert res1.status_code == 200
    assert len(res1.json()["items"]) == 1
    assert res1.json()["items"][0]["email"] == "findme@test.com"

    # Search by partial name
    res2 = client.get("/api/admin/users?search=Alpha", headers=headers)
    assert res2.status_code == 200
    assert len(res2.json()["items"]) == 1

    # Search by email
    res3 = client.get("/api/admin/users?search=findme", headers=headers)
    assert res3.status_code == 200
    assert len(res3.json()["items"]) == 1

def test_account_deactivation_retains_id(db_session):
    """Test that deactivating an account does not change its Citizen ID."""
    u = User(email="deact@test.com", full_name="Test", password_hash="h", citizen_id="SCAI-CIT-12345678")
    db_session.add(u)
    db_session.commit()

    admin_u = User(email="admin2@test.com", password_hash="h", full_name="Admin", role="admin", admin_role="super_admin")
    db_session.add(admin_u)
    db_session.commit()

    from app.core.security import create_access_token
    token = create_access_token(admin_u)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.put(f"/api/admin/users/{u.id}/toggle", headers=headers)
    assert res.status_code == 200

    db_session.refresh(u)
    assert u.is_active is False
    assert u.citizen_id == "SCAI-CIT-12345678"
