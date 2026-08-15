import os
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = "staff@sanskritika.in"
PASSWORD = "music2026"

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

def test_auth_and_protected_endpoints(client):
    assert client.get(f"{BASE_URL}/api/dashboard").status_code == 401
    r = client.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200 and r.json()["role"] == "staff"
    assert "access_token" in r.cookies and r.cookies["access_token"]
    me = client.get(f"{BASE_URL}/api/auth/me")
    assert me.status_code == 200 and me.json()["email"] == EMAIL
    for endpoint in ["dashboard", "students", "attendance", "fees"]:
        assert client.get(f"{BASE_URL}/api/{endpoint}").status_code == 200

def test_core_data_shapes_and_filters(client):
    client.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    dashboard = client.get(f"{BASE_URL}/api/dashboard").json()
    assert dashboard["total_students"] == 8 and len(dashboard["students"]) == 8
    students = client.get(f"{BASE_URL}/api/students").json()
    assert len(students) == 8 and all("_id" not in s for s in students)
    filtered = client.get(f"{BASE_URL}/api/students", params={"subject":"Vocal"}).json()
    assert len(filtered) == 2
    attendance = client.get(f"{BASE_URL}/api/attendance").json()
    assert len(attendance) == 8 and all("student" in row and "record" in row for row in attendance)
    fees = client.get(f"{BASE_URL}/api/fees").json()
    assert len(fees) == 8 and all("due_date" in fee for fee in fees)

def test_attendance_save_and_fee_payment(client):
    client.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    students = client.get(f"{BASE_URL}/api/students").json(); sid = students[0]["id"]
    day = client.get(f"{BASE_URL}/api/attendance").json()[0]["record"]["date"]
    r = client.post(f"{BASE_URL}/api/attendance", json={"student_id":sid,"date":day,"status":"PRESENT","remarks":"TEST_"})
    assert r.status_code == 200 and r.json()["status"] == "PRESENT"
    fees = client.get(f"{BASE_URL}/api/fees", params={"status":"OVERDUE"}).json()
    if fees:
        fee = fees[0]; pay = client.post(f"{BASE_URL}/api/fees/pay", json={"fee_id":fee["id"],"amount":1,"payment_mode":"CASH"})
        assert pay.status_code == 200 and pay.json()["receipt_number"]

def test_logout_clears_session(client):
    client.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert client.post(f"{BASE_URL}/api/auth/logout").status_code == 200
    assert client.get(f"{BASE_URL}/api/auth/me").status_code == 401
