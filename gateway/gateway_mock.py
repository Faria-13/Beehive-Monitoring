# gateway_mock.py
import requests
from datetime import datetime

SUPABASE_URL = "https://tpnduwecssoydxsygwar.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwbmR1d2Vjc3NveWR4c3lnd2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTQ0NzgsImV4cCI6MjA4NDY5MDQ3OH0.dugPDYecKj2Sw-hjPh59mp9NVn9PRaCltCi3Ism5lqk"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

data = {
    "sensor_id": 41,
    "timestamp": datetime.utcnow().isoformat(),
    "value": 34.5,
    "unit": "°C",
    "is_valid": True
}

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/sensor_readings",
    headers=headers,
    json=data
)

if response.status_code == 201:
    print("Success! Reading inserted.")
else:
    print(f"Error {response.status_code}: {response.text}")