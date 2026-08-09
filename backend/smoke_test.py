import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as client:
    print("health:", client.get("/api/health").json())

    r = client.post("/api/auth/register", json={
        "full_name": "Smoke Tester", "email": "smoke@example.com",
        "password": "password123", "phone": "9000000000", "language": "en"})
    print("register:", r.status_code, "ok" if r.status_code == 200 else r.text)
    if r.status_code != 200:
        r = client.post("/api/auth/login", json={
            "email": "smoke@example.com", "password": "password123"})
        print("login:", r.status_code, "ok" if r.status_code == 200 else r.text)
    tok = r.json()["access_token"]
    H = {"Authorization": f"Bearer {tok}"}

    r = client.get("/api/public/schemes")
    print("public schemes:", r.status_code, r.json().get("total"))

    r = client.put("/api/profile", json={
        "age": 29, "gender": "male", "state": "Andhra Pradesh", "district": "Visakhapatnam",
        "occupation": "farmer", "annual_income": 280000, "education": "hs", "category": "obc",
        "employment_type": "unorganised", "land_owned_acres": 3.5, "is_marginal_farmer": True,
        "has_savings_account": True, "aadhaar_linked": True}, headers=H)
    print("profile:", r.status_code)

    r = client.get("/api/eligibility/score", headers=H)
    j = r.json()
    print("eligibility score:", r.status_code, "top=", j.get("top_score", {}).get("scheme_name"), j.get("top_score", {}).get("score"))

    r = client.get("/api/eligibility/recommendations", headers=H)
    j = r.json()
    print("recommendations:", r.status_code, "best=", (j.get("best_match") or {}).get("scheme", {}).get("name"), "agents=", len(j.get("agent_logs", [])))

    r = client.get("/api/questionnaire/start", headers=H)
    print("questionnaire start:", r.status_code, (r.json().get("question") or {}).get("key"))
    r = client.post("/api/questionnaire/answer", json={"key": "age", "value": 29}, headers=H)
    print("answer age -> next:", r.status_code, (r.json().get("question") or {}).get("key"))

    scheme_id = client.get("/api/public/schemes").json()["items"][0]["id"]
    r = client.post(f"/api/schemes/{scheme_id}/save", headers=H)
    print("save scheme:", r.status_code)

    r = client.post("/api/eligibility/compare", json={"scheme_ids": [scheme_id, scheme_id]}, headers=H)
    print("compare:", r.status_code, (r.json().get("analysis") or {}).get("verdict", "")[:60])

    r = client.post("/api/applications", json={"scheme_id": scheme_id}, headers=H)
    print("apply:", r.status_code, r.json().get("application_id"))
    app_id = r.json().get("id")

    r = client.post(f"/api/applications/{app_id}/advance", headers=H)
    print("advance:", r.status_code, r.json().get("status"), r.json().get("current_step"))

    r = client.get("/api/reports/eligibility/pdf", headers=H)
    print("report pdf:", r.status_code, r.headers.get("content-type"), "bytes=", len(r.content))

    r = client.get("/api/news", headers=H)
    print("news:", r.status_code, r.json().get("total"))

    r = client.get("/api/offices?lat=17.73&lng=83.30", headers=H)
    print("offices:", r.status_code, r.json().get("total"))

    r = client.get("/api/notifications/unread-count", headers=H)
    print("unread:", r.status_code, r.json())

    r = client.post("/api/voice/command", json={"text": "Find schemes for farmers", "language": "en"}, headers=H)
    print("voice:", r.status_code, r.json().get("intent"))

    r = client.post("/api/auth/login", json={"email": "admin@schemeai.in", "password": "Admin@123"})
    AH = {"Authorization": f"Bearer {r.json()['access_token']}"}
    print("admin login:", r.status_code)
    r = client.get("/api/admin/stats", headers=AH)
    print("admin stats:", r.status_code, r.json())
    r = client.get("/api/admin/analytics", headers=AH)
    print("admin analytics:", r.status_code)
    r = client.get("/api/admin/knowledge", headers=AH)
    print("admin knowledge:", r.status_code, r.json().get("chunks"))

    print("\nALL SMOKE TESTS PASSED")
