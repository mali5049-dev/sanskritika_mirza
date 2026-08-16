"""Regression suite for Sanskritika Mirza Academy - RBAC, applications, batches, fees, attendance."""
import os, uuid, requests, pytest
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = ("staff@sanskritika.in", "music2026")
GUITAR = ("guitar.teacher@sanskritika.in", "teacher123")
VOCAL = ("vocal.teacher@sanskritika.in", "teacher123")
STUDENT1 = ("student1@sanskritika.in", "student123")


def _session(creds=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if creds:
        r = s.post(f"{BASE}/api/auth/login", json={"email": creds[0], "password": creds[1]})
        assert r.status_code == 200, r.text
    return s


# ===== Auth / RBAC =====
class TestAuth:
    def test_login_admin(self):
        s = _session()
        r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        assert "access_token" in s.cookies
        me = s.get(f"{BASE}/api/auth/me").json()
        assert me["role"] == "admin" and me["email"] == ADMIN[0]

    def test_login_bad_password(self):
        s = _session()
        r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN[0], "password": "nope"})
        assert r.status_code == 401

    def test_unauth_admin_endpoint(self):
        r = requests.get(f"{BASE}/api/admin/students")
        assert r.status_code == 401

    def test_student_forbidden_on_admin(self):
        s = _session(STUDENT1)
        assert s.get(f"{BASE}/api/admin/dashboard").status_code == 403

    def test_admin_forbidden_on_teacher(self):
        s = _session(ADMIN)
        assert s.get(f"{BASE}/api/teacher/batches").status_code == 403

    def test_logout(self):
        s = _session(ADMIN)
        assert s.post(f"{BASE}/api/auth/logout").status_code == 200
        assert s.get(f"{BASE}/api/auth/me").status_code == 401


# ===== Public applications =====
class TestPublic:
    def test_track_pending(self):
        r = requests.get(f"{BASE}/api/applications/track/SM-APP-2026-200")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "PENDING"
        assert d["tracking_id"] == "SM-APP-2026-200"

    def test_track_rejected(self):
        r = requests.get(f"{BASE}/api/applications/track/SM-APP-2026-099")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "REJECTED"
        assert d["rejection_reason"]

    def test_track_missing(self):
        r = requests.get(f"{BASE}/api/applications/track/SM-APP-XXXX")
        assert r.status_code == 404

    def test_submit_application(self):
        payload = {
            "student_name": "TEST_Applicant",
            "father_guardian_phone": "9111222333",
            "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
            "subjects": ["Guitar"],
            "preferred_sunday_slot": "8:00 AM - 9:30 AM",
        }
        r = requests.post(f"{BASE}/api/applications", json=payload)
        assert r.status_code == 200
        tid = r.json()["tracking_id"]
        assert tid.startswith("SM-APP-")
        # verify GET retrieval
        got = requests.get(f"{BASE}/api/applications/track/{tid}").json()
        assert got["student_name"] == "TEST_Applicant"

    def test_submit_missing_required(self):
        r = requests.post(f"{BASE}/api/applications", json={"student_name": "", "father_guardian_phone": ""})
        assert r.status_code == 400


# ===== Admin dashboard =====
class TestAdminDashboard:
    def test_dashboard(self):
        s = _session(ADMIN)
        d = s.get(f"{BASE}/api/admin/dashboard").json()
        assert "total_students" in d and d["total_students"] >= 8
        assert "pending_applications" in d
        assert "pending_amount" in d


# ===== Admin applications approve/reject =====
class TestApproveReject:
    def _create_app(self):
        r = requests.post(f"{BASE}/api/applications", json={
            "student_name": f"TEST_Approve_{uuid.uuid4().hex[:4]}",
            "father_guardian_phone": "9111222444",
            "subjects": ["Guitar"],
        })
        return r.json()["id"], r.json()["tracking_id"]

    def test_approve_creates_student_and_login(self):
        app_id, tid = self._create_app()
        s = _session(ADMIN)
        roll = f"TEST{uuid.uuid4().hex[:6].upper()}"
        temp_pw = "TempPass123!"
        r = s.post(f"{BASE}/api/admin/applications/{app_id}/approve", json={
            "roll_number": roll, "batch_id": "batch-g1", "monthly_fee": 1800,
            "temp_password": temp_pw, "initial_payment": 0,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["roll_number"] == roll
        assert data["initial_fee"]["due_date"]
        # new student should be able to log in
        new_email = data["user_email"]
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        login = s2.post(f"{BASE}/api/auth/login", json={"email": new_email, "password": temp_pw})
        assert login.status_code == 200
        j = login.json()
        assert j["must_change_password"] is True
        assert j["role"] == "student"
        me = s2.get(f"{BASE}/api/student/me").json()
        assert me["student"]["roll_number"] == roll

    def test_reject_flow(self):
        app_id, tid = self._create_app()
        s = _session(ADMIN)
        r = s.post(f"{BASE}/api/admin/applications/{app_id}/reject", json={"reason": "TEST reject reason"})
        assert r.status_code == 200
        got = requests.get(f"{BASE}/api/applications/track/{tid}").json()
        assert got["status"] == "REJECTED"
        assert got["rejection_reason"] == "TEST reject reason"


# ===== Teachers =====
class TestTeachers:
    def test_add_and_toggle_teacher(self):
        s = _session(ADMIN)
        email = f"test_teacher_{uuid.uuid4().hex[:5]}@example.com"
        r = s.post(f"{BASE}/api/admin/teachers", json={
            "name": "TEST_Teacher", "email": email, "phone": "9000", "specialization": ["Drums"], "password": "temp123"
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        # toggle inactive
        upd = s.patch(f"{BASE}/api/admin/teachers/{tid}", json={"status": "INACTIVE"})
        assert upd.status_code == 200 and upd.json()["status"] == "INACTIVE"


# ===== Batches =====
class TestBatches:
    def test_add_batch(self):
        s = _session(ADMIN)
        teachers = s.get(f"{BASE}/api/admin/teachers").json()
        active = [t for t in teachers if t["status"] == "ACTIVE"][0]
        r = s.post(f"{BASE}/api/admin/batches", json={
            "name": f"TEST_Batch_{uuid.uuid4().hex[:4]}", "instrument": "Guitar",
            "slot": "3:00 PM - 4:30 PM", "teacher_id": active["id"], "capacity": 8, "day_of_week": "Sunday"
        })
        assert r.status_code == 200
        # visible in list
        batches = s.get(f"{BASE}/api/admin/batches").json()
        assert any(b["id"] == r.json()["id"] for b in batches)


# ===== Attendance =====
class TestAttendance:
    def test_admin_save_attendance(self):
        s = _session(ADMIN)
        rows = s.get(f"{BASE}/api/admin/attendance").json()
        assert rows
        sid = rows[0]["student"]["id"]
        r = s.post(f"{BASE}/api/admin/attendance", json={
            "student_id": sid, "date": rows[0]["record"]["date"], "status": "PRESENT", "remarks": "TEST"
        })
        assert r.status_code == 200 and r.json()["status"] == "PRESENT"


# ===== Fees =====
class TestFees:
    def test_filter_and_pay(self):
        s = _session(ADMIN)
        # generate ensures a fee exists for month
        s.post(f"{BASE}/api/admin/fees/generate")
        due_rows = s.get(f"{BASE}/api/admin/fees", params={"status": "DUE"}).json()
        overdue_rows = s.get(f"{BASE}/api/admin/fees", params={"status": "OVERDUE"}).json()
        target = due_rows or overdue_rows
        assert target, "expected at least one unpaid fee"
        fee = target[0]
        pay = s.post(f"{BASE}/api/admin/fees/pay", json={
            "fee_id": fee["id"], "amount": 100, "payment_mode": "CASH"
        })
        assert pay.status_code == 200
        assert pay.json()["receipt_number"]

    def test_generate_second_sunday(self):
        s = _session(ADMIN)
        r = s.post(f"{BASE}/api/admin/fees/generate")
        assert r.status_code == 200
        data = r.json()
        # verify due_date is a Sunday in [8..14]
        from datetime import date
        y, m, d = map(int, data["due_date"].split("-"))
        dd = date(y, m, d)
        assert dd.weekday() == 6  # Sunday
        assert 8 <= d <= 14


# ===== Teacher endpoints =====
class TestTeacherPortal:
    def test_guitar_teacher_sees_only_own(self):
        s = _session(GUITAR)
        data = s.get(f"{BASE}/api/teacher/batches").json()
        bids = {b["id"] for b in data["batches"]}
        assert bids == {"batch-g1", "batch-g2"}

    def test_guitar_teacher_forbidden_other_batch(self):
        s = _session(GUITAR)
        r = s.get(f"{BASE}/api/teacher/batches/batch-v1/roster")
        assert r.status_code == 403

    def test_guitar_roster_and_mark(self):
        s = _session(GUITAR)
        roster = s.get(f"{BASE}/api/teacher/batches/batch-g1/roster").json()
        assert roster["students"]
        sid = roster["students"][0]["id"]
        r = s.post(f"{BASE}/api/teacher/attendance", json={
            "student_id": sid, "batch_id": "batch-g1", "date": "2026-01-11", "status": "PRESENT"
        })
        assert r.status_code == 200


# ===== Student portal =====
class TestStudent:
    def test_student_me(self):
        s = _session(STUDENT1)
        d = s.get(f"{BASE}/api/student/me").json()
        assert d["student"]["roll_number"] == "SM2026001"
        assert d["teacher"]["name"] == "Rohan Verma"
        assert isinstance(d["fees"], list)
        assert isinstance(d["attendance"], list)


# ===== Session persistence =====
def test_session_persists_across_requests():
    s = _session(ADMIN)
    for _ in range(3):
        assert s.get(f"{BASE}/api/auth/me").status_code == 200
