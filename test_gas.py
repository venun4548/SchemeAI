import httpx
import json

url = "https://script.google.com/macros/s/AKfycbzae6jE4bBTl-RL3jn6C6IrGH0AQ6AqU4iyD84SEu2j7EMktGD4W7rONivbjz5hj6sJ/exec"
payload = {
    "action": "syncVerify",
    "sheet": "Users",
    "id_column": "user_id",
    "id_value": "test"
}

with httpx.Client(timeout=15.0, follow_redirects=True) as client:
    r = client.post(url, params={"action": "syncVerify"}, json=payload)
    print("STATUS:", r.status_code)
    print("BODY:", r.text)
