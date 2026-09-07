import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.seed.seeder import seed_all
from app.models.models import User
from app.core.security import hash_password

def test_admin_secondary_security_verification():
    init_db()
    with SessionLocal() as db:
        seed_all(db)
        admin = db.query(User).filter_by(email="admin@schemeai.in").first()
        # Set a known test PIN '123456' for test repeatability
        admin.secondary_password_hash = hash_password("7788")
        db.commit()

    client = TestClient(app)

    print("--- Test 1: Admin login with correct primary credentials ---")
    login_resp = client.post("/api/auth/login", json={
        "email": "admin@schemeai.in",
        "password": "Admin@123"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    initial_token = login_data["access_token"]
    assert login_data["user"]["secondary_verified"] is False, "Initial token must NOT be secondary_verified"
    print("[OK] Admin login succeeded, initial token has secondary_verified=False")

    print("\n--- Test 2: Accessing protected admin endpoint with unverified token ---")
    admin_prof_resp = client.get("/api/admin/profile", headers={
        "Authorization": f"Bearer {initial_token}"
    })
    assert admin_prof_resp.status_code == 403, f"Expected 403, got: {admin_prof_resp.status_code} - {admin_prof_resp.text}"
    assert "Admin secondary security verification required" in admin_prof_resp.text
    print("[OK] Access to admin API with unverified token correctly blocked (HTTP 403)")

    print("\n--- Test 3: Submitting invalid secondary PIN ---")
    wrong_pin_resp = client.post("/api/auth/verify-secondary", json={
        "pin": "wrongpin999"
    }, headers={
        "Authorization": f"Bearer {initial_token}"
    })
    assert wrong_pin_resp.status_code == 401, f"Expected 401, got: {wrong_pin_resp.status_code} - {wrong_pin_resp.text}"
    assert "Invalid security PIN/password. Access denied." in wrong_pin_resp.json()["detail"]
    print("[OK] Invalid PIN rejected with HTTP 401 and 'Invalid security PIN/password. Access denied.'")

    print("\n--- Test 4: Submitting correct secondary PIN ---")
    correct_pin_resp = client.post("/api/auth/verify-secondary", json={
        "pin": "7788"
    }, headers={
        "Authorization": f"Bearer {initial_token}"
    })
    assert correct_pin_resp.status_code == 200, f"Expected 200, got: {correct_pin_resp.status_code} - {correct_pin_resp.text}"
    verified_data = correct_pin_resp.json()
    verified_token = verified_data["access_token"]
    assert verified_data["user"]["secondary_verified"] is True
    print("[OK] Correct PIN verified successfully, new token has secondary_verified=True")

    print("\n--- Test 5: Accessing protected admin endpoint with verified token ---")
    admin_prof_verified_resp = client.get("/api/admin/profile", headers={
        "Authorization": f"Bearer {verified_token}"
    })
    assert admin_prof_verified_resp.status_code == 200, f"Expected 200, got: {admin_prof_verified_resp.status_code} - {admin_prof_verified_resp.text}"
    prof = admin_prof_verified_resp.json()
    assert prof["admin"]["email"] == "admin@schemeai.in"
    print("[OK] Admin API access granted with verified token (HTTP 200)")

    print("\n--- Test 6: Citizen login (no secondary PIN needed for citizen dashboard) ---")
    citizen_login_resp = client.post("/api/auth/login", json={
        "email": "demo@schemeai.in",
        "password": "Demo@123"
    })
    assert citizen_login_resp.status_code == 200
    citizen_token = citizen_login_resp.json()["access_token"]
    
    # Citizen trying to access admin endpoint
    citizen_admin_resp = client.get("/api/admin/profile", headers={
        "Authorization": f"Bearer {citizen_token}"
    })
    assert citizen_admin_resp.status_code == 403
    print("[OK] Citizen token cannot access admin routes")

    # Citizen trying to call verify-secondary
    citizen_sec_resp = client.post("/api/auth/verify-secondary", json={
        "pin": "123456"
    }, headers={
        "Authorization": f"Bearer {citizen_token}"
    })
    assert citizen_sec_resp.status_code == 403
    print("[OK] Citizen cannot call verify-secondary")

    print("\nALL SECURITY TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_admin_secondary_security_verification()
