from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os, uuid, bcrypt, jwt
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Sanskritika Mirza Academy API")
api = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"
SEED_VERSION = 4

# ===== Helpers =====
def now_iso(): return datetime.now(timezone.utc).isoformat()
def today_iso(): return date.today().isoformat()
def second_sunday(year, month):
    first = date(year, month, 1)
    return first + timedelta(days=(6 - first.weekday()) % 7 + 7)
def hash_pw(v): return bcrypt.hashpw(v.encode(), bcrypt.gensalt()).decode()
def verify_pw(v, h): return bcrypt.checkpw(v.encode(), h.encode())
def make_token(user):
    return jwt.encode({"sub": user["id"], "email": user["email"], "role": user["role"], "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)
def new_tracking_id(): return f"SM-APP-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
def new_receipt(): return f"SM-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:5].upper()}"

# ===== Models =====
class LoginInput(BaseModel):
    email: str
    password: str

class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str

class ApplicationInput(BaseModel):
    student_name: str
    father_guardian_phone: str
    dob: str = ""
    gender: str = "OTHER"
    father_guardian_name: str = ""
    mother_name: str = ""
    mother_phone: str = ""
    email: str = ""
    address: str = ""
    school_college_name: str = ""
    educational_qualification: str = ""
    grade_class: str = ""
    prior_music_knowledge: str = ""
    subjects: List[str] = []
    preferred_sunday_slot: str = ""
    weekday_slot: str = ""
    aim_of_learning: str = ""

class ApproveInput(BaseModel):
    roll_number: str
    batch_id: str
    monthly_fee: float
    temp_password: str
    initial_payment: float = 0
    payment_mode: str = "CASH"

class RejectInput(BaseModel):
    reason: str

class TeacherInput(BaseModel):
    name: str
    email: str
    phone: str = ""
    specialization: List[str] = []
    password: str

class TeacherUpdateInput(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[List[str]] = None
    status: Optional[str] = None

class BatchInput(BaseModel):
    name: str
    instrument: str
    slot: str
    teacher_id: str
    capacity: int = 12
    day_of_week: str = "Sunday"

class BatchUpdateInput(BaseModel):
    name: Optional[str] = None
    instrument: Optional[str] = None
    slot: Optional[str] = None
    teacher_id: Optional[str] = None
    capacity: Optional[int] = None
    day_of_week: Optional[str] = None

class AttendanceInput(BaseModel):
    student_id: str
    batch_id: str = ""
    date: str
    status: str
    remarks: str = ""

class PaymentInput(BaseModel):
    fee_id: str
    amount: float
    payment_mode: str

class StudentUpdateInput(BaseModel):
    status: Optional[str] = None
    batch_id: Optional[str] = None
    monthly_fee: Optional[float] = None

# ===== Auth =====
async def current_user(request: Request):
    raw = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not raw: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(raw, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user or user.get("status") != "ACTIVE": raise HTTPException(401, "Account not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired")

def require(*roles):
    async def guard(user=Depends(current_user)):
        if user["role"] not in roles: raise HTTPException(403, "Not authorised for this action")
        return user
    return guard

# ===== Root & Auth endpoints =====
@api.get("/")
async def root(): return {"message": "Sanskritika Mirza Academy API"}

@api.post("/auth/login")
async def login(data: LoginInput, response: Response, request: Request):
    email = data.email.lower().strip()
    identifier = f"{request.client.host if request.client else 'unknown'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("locked_until", "") > now_iso():
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    user = await db.users.find_one({"email": email})
    if not user or user.get("status") != "ACTIVE" or not verify_pw(data.password, user["password_hash"]):
        failed = (attempt.get("failed", 0) if attempt else 0) + 1
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"identifier": identifier, "failed": failed, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat() if failed >= 5 else ""}},
            upsert=True,
        )
        raise HTTPException(401, "Incorrect email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    response.set_cookie("access_token", make_token(user), httponly=True, samesite="none", secure=True, max_age=28800)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "must_change_password": user.get("must_change_password", False)}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "must_change_password": user.get("must_change_password", False)}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}

@api.post("/auth/change-password")
async def change_password(data: ChangePasswordInput, user=Depends(current_user)):
    stored = await db.users.find_one({"id": user["id"]})
    if not stored or not verify_pw(data.current_password, stored["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(data.new_password), "must_change_password": False}})
    return {"ok": True}

# ===== Public applications =====
@api.post("/applications")
async def create_application(data: ApplicationInput):
    if not data.student_name.strip() or not data.father_guardian_phone.strip():
        raise HTTPException(400, "Student name and guardian phone are required")
    tid = new_tracking_id()
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "tracking_id": tid, "status": "PENDING", "rejection_reason": "", "created_at": now_iso(), "reviewed_at": "", "approved_by": "", "student_id": ""})
    await db.applications.insert_one(doc)
    return {"tracking_id": tid, "id": doc["id"], "status": "PENDING", "student_name": doc["student_name"]}

@api.get("/applications/track/{tracking_id}")
async def track_application(tracking_id: str):
    app_doc = await db.applications.find_one({"tracking_id": tracking_id.strip().upper()}, {"_id": 0})
    if not app_doc: raise HTTPException(404, "No application found for that tracking ID")
    return {"tracking_id": app_doc["tracking_id"], "student_name": app_doc["student_name"], "subjects": app_doc.get("subjects", []), "preferred_sunday_slot": app_doc.get("preferred_sunday_slot", ""), "status": app_doc["status"], "created_at": app_doc["created_at"], "reviewed_at": app_doc.get("reviewed_at", ""), "rejection_reason": app_doc.get("rejection_reason", "")}

# ===== Admin dashboard =====
@api.get("/admin/dashboard")
async def admin_dashboard(user=Depends(require("admin"))):
    students = await db.students.find({}, {"_id": 0}).to_list(2000)
    fees = await db.fees.find({}, {"_id": 0}).to_list(4000)
    attendance = await db.attendance.find({"date": today_iso()}, {"_id": 0}).to_list(2000)
    pending_apps = await db.applications.count_documents({"status": "PENDING"})
    active = [s for s in students if s["status"] == "ACTIVE"]
    overdue = [f for f in fees if f["status"] == "OVERDUE"]
    paid = sum(f.get("paid_amount", 0) for f in fees)
    rate = round(100 * sum(a["status"] == "PRESENT" for a in attendance) / len(attendance)) if attendance else 0
    by_id = {s["id"]: s for s in students}
    action = [{**f, "student_name": by_id.get(f["student_id"], {}).get("student_name", "Student")} for f in overdue[:5]]
    return {"total_students": len(active), "attendance_rate": rate, "overdue_count": len(overdue), "pending_applications": pending_apps, "pending_amount": round(sum(f["monthly_fee_amount"] - f.get("paid_amount", 0) for f in fees if f["status"] != "PAID"), 2), "collected": paid, "action_required": action, "students": students}

# ===== Admin: applications =====
@api.get("/admin/applications")
async def admin_applications(status: str = "", user=Depends(require("admin"))):
    q = {"status": status.upper()} if status else {}
    return await db.applications.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/admin/applications/{app_id}/approve")
async def approve_application(app_id: str, data: ApproveInput, user=Depends(require("admin"))):
    app_doc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc: raise HTTPException(404, "Application not found")
    if app_doc["status"] != "PENDING": raise HTTPException(400, "Application already reviewed")
    batch = await db.batches.find_one({"id": data.batch_id}, {"_id": 0})
    if not batch: raise HTTPException(400, "Invalid batch")
    if await db.students.find_one({"roll_number": data.roll_number}, {"_id": 0}):
        raise HTTPException(400, "Roll number already in use")
    email = (app_doc.get("email") or "").lower().strip() or f"{app_doc['tracking_id'].lower()}@sanskritika.in"
    if await db.users.find_one({"email": email}):
        email = f"{app_doc['tracking_id'].lower()}@sanskritika.in"
    uid = f"user-{uuid.uuid4().hex[:8]}"
    sid = f"student-{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({"id": uid, "email": email, "name": app_doc["student_name"], "role": "student", "phone": app_doc.get("father_guardian_phone", ""), "status": "ACTIVE", "password_hash": hash_pw(data.temp_password), "must_change_password": True, "created_at": now_iso(), "student_id": sid})
    student_doc = {"id": sid, "user_id": uid, "application_id": app_id, "roll_number": data.roll_number, "student_name": app_doc["student_name"], "dob": app_doc.get("dob", ""), "gender": app_doc.get("gender", "OTHER"), "email": email, "address": app_doc.get("address", ""), "father_guardian_name": app_doc.get("father_guardian_name", ""), "father_guardian_phone": app_doc.get("father_guardian_phone", ""), "mother_name": app_doc.get("mother_name", ""), "mother_phone": app_doc.get("mother_phone", ""), "school_college_name": app_doc.get("school_college_name", ""), "educational_qualification": app_doc.get("educational_qualification", ""), "grade_class": app_doc.get("grade_class", ""), "prior_music_knowledge": app_doc.get("prior_music_knowledge", ""), "subjects": app_doc.get("subjects", []) or [batch["instrument"]], "batch_id": data.batch_id, "sunday_batch_slot": batch["slot"], "weekday_batch_slot": app_doc.get("weekday_slot", ""), "monthly_fee": data.monthly_fee, "status": "ACTIVE", "enrollment_type": "FRESH", "admission_date": today_iso(), "aim_of_learning": app_doc.get("aim_of_learning", ""), "photo_url": ""}
    await db.students.insert_one(student_doc)
    due = second_sunday(date.today().year, date.today().month).isoformat()
    month = date.today().strftime("%Y-%m")
    paid = data.initial_payment
    status_val = "PAID" if paid >= data.monthly_fee else ("PARTIAL" if paid > 0 else ("OVERDUE" if today_iso() > due else "DUE"))
    fee_doc = {"id": str(uuid.uuid4()), "student_id": sid, "month_year": month, "monthly_fee_amount": data.monthly_fee, "due_date": due, "paid_amount": paid, "status": status_val, "payment_date": today_iso() if paid else "", "payment_mode": data.payment_mode if paid else "", "receipt_number": new_receipt() if paid else ""}
    await db.fees.insert_one(fee_doc)
    await db.applications.update_one({"id": app_id}, {"$set": {"status": "APPROVED", "reviewed_at": now_iso(), "approved_by": user["id"], "student_id": sid}})
    fresh_fee = await db.fees.find_one({"id": fee_doc["id"]}, {"_id": 0})
    return {"student_id": sid, "user_email": email, "temp_password": data.temp_password, "roll_number": data.roll_number, "batch": batch["name"], "initial_fee": fresh_fee}

@api.post("/admin/applications/{app_id}/reject")
async def reject_application(app_id: str, data: RejectInput, user=Depends(require("admin"))):
    result = await db.applications.update_one({"id": app_id, "status": "PENDING"}, {"$set": {"status": "REJECTED", "rejection_reason": data.reason, "reviewed_at": now_iso(), "approved_by": user["id"]}})
    if not result.matched_count: raise HTTPException(400, "Application not found or already reviewed")
    return {"ok": True}

# ===== Admin: students =====
@api.get("/admin/students")
async def admin_students(subject: str = "", slot: str = "", status: str = "", batch_id: str = "", user=Depends(require("admin"))):
    q = {}
    if subject: q["subjects"] = subject
    if slot: q["sunday_batch_slot"] = slot
    if status: q["status"] = status
    if batch_id: q["batch_id"] = batch_id
    return await db.students.find(q, {"_id": 0}).sort("student_name", 1).to_list(2000)

async def _student_detail(sid: str):
    student = await db.students.find_one({"id": sid}, {"_id": 0})
    if not student: raise HTTPException(404, "Student not found")
    attendance = await db.attendance.find({"student_id": sid}, {"_id": 0}).sort("date", -1).to_list(500)
    fees = await db.fees.find({"student_id": sid}, {"_id": 0}).sort("month_year", -1).to_list(100)
    batch = await db.batches.find_one({"id": student.get("batch_id", "")}, {"_id": 0}) if student.get("batch_id") else None
    teacher = None
    if batch:
        teacher = await db.teachers.find_one({"id": batch["teacher_id"]}, {"_id": 0})
    return {"student": student, "attendance": attendance, "fees": fees, "batch": batch, "teacher": teacher}

@api.get("/admin/students/{sid}")
async def admin_student_detail(sid: str, user=Depends(require("admin"))):
    return await _student_detail(sid)

@api.post("/admin/students/{sid}/renew")
async def admin_renew(sid: str, user=Depends(require("admin"))):
    result = await db.students.update_one({"id": sid}, {"$set": {"enrollment_type": "RENEWAL", "admission_date": today_iso(), "status": "ACTIVE"}})
    if not result.matched_count: raise HTTPException(404, "Student not found")
    return await db.students.find_one({"id": sid}, {"_id": 0})

@api.patch("/admin/students/{sid}")
async def admin_update_student(sid: str, data: StudentUpdateInput, user=Depends(require("admin"))):
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not updates: raise HTTPException(400, "Nothing to update")
    if "batch_id" in updates:
        batch = await db.batches.find_one({"id": updates["batch_id"]}, {"_id": 0})
        if not batch: raise HTTPException(400, "Invalid batch")
        updates["sunday_batch_slot"] = batch["slot"]
    result = await db.students.update_one({"id": sid}, {"$set": updates})
    if not result.matched_count: raise HTTPException(404, "Student not found")
    return await db.students.find_one({"id": sid}, {"_id": 0})

# ===== Admin: teachers =====
@api.get("/admin/teachers")
async def admin_teachers(user=Depends(require("admin"))):
    return await db.teachers.find({}, {"_id": 0}).sort("name", 1).to_list(200)

@api.post("/admin/teachers")
async def admin_create_teacher(data: TeacherInput, user=Depends(require("admin"))):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = f"user-t{uuid.uuid4().hex[:6]}"
    tid = f"teacher-{uuid.uuid4().hex[:6]}"
    await db.users.insert_one({"id": uid, "email": email, "name": data.name, "role": "teacher", "phone": data.phone, "status": "ACTIVE", "password_hash": hash_pw(data.password), "must_change_password": True, "created_at": now_iso()})
    teacher = {"id": tid, "user_id": uid, "name": data.name, "email": email, "phone": data.phone, "specialization": data.specialization, "status": "ACTIVE", "hire_date": today_iso()}
    await db.teachers.insert_one(teacher)
    return await db.teachers.find_one({"id": tid}, {"_id": 0})

@api.patch("/admin/teachers/{tid}")
async def admin_update_teacher(tid: str, data: TeacherUpdateInput, user=Depends(require("admin"))):
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not updates: raise HTTPException(400, "Nothing to update")
    result = await db.teachers.update_one({"id": tid}, {"$set": updates})
    if not result.matched_count: raise HTTPException(404, "Teacher not found")
    teacher = await db.teachers.find_one({"id": tid}, {"_id": 0})
    if "status" in updates:
        await db.users.update_one({"id": teacher["user_id"]}, {"$set": {"status": updates["status"]}})
    return teacher

# ===== Admin: batches =====
@api.get("/admin/batches")
async def admin_batches(user=Depends(require("admin"))):
    batches = await db.batches.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    teachers = await db.teachers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    name_by_teacher = {t["id"]: t["name"] for t in teachers}
    counts = {}
    async for s in db.students.find({"status": "ACTIVE"}, {"_id": 0, "batch_id": 1}):
        bid = s.get("batch_id", "")
        counts[bid] = counts.get(bid, 0) + 1
    return [{**b, "teacher_name": name_by_teacher.get(b["teacher_id"], "Unassigned"), "enrolled_count": counts.get(b["id"], 0)} for b in batches]

@api.post("/admin/batches")
async def admin_create_batch(data: BatchInput, user=Depends(require("admin"))):
    teacher = await db.teachers.find_one({"id": data.teacher_id}, {"_id": 0})
    if not teacher: raise HTTPException(400, "Invalid teacher")
    doc = data.model_dump()
    doc["id"] = f"batch-{uuid.uuid4().hex[:6]}"
    await db.batches.insert_one(doc)
    return await db.batches.find_one({"id": doc["id"]}, {"_id": 0})

@api.patch("/admin/batches/{bid}")
async def admin_update_batch(bid: str, data: BatchUpdateInput, user=Depends(require("admin"))):
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not updates: raise HTTPException(400, "Nothing to update")
    if "teacher_id" in updates:
        if not await db.teachers.find_one({"id": updates["teacher_id"]}, {"_id": 0}):
            raise HTTPException(400, "Invalid teacher")
    result = await db.batches.update_one({"id": bid}, {"$set": updates})
    if not result.matched_count: raise HTTPException(404, "Batch not found")
    batch = await db.batches.find_one({"id": bid}, {"_id": 0})
    # Keep enrolled students' sunday_batch_slot mirrored with the batch slot
    if "slot" in updates:
        await db.students.update_many({"batch_id": bid}, {"$set": {"sunday_batch_slot": batch["slot"]}})
    return batch

# ===== Admin: attendance =====
@api.get("/admin/attendance")
async def admin_attendance(day: str = "", slot: str = "", batch_id: str = "", user=Depends(require("admin"))):
    d = day or today_iso()
    q = {"status": "ACTIVE"}
    if slot: q["sunday_batch_slot"] = slot
    if batch_id: q["batch_id"] = batch_id
    students = await db.students.find(q, {"_id": 0}).sort("student_name", 1).to_list(1000)
    ids = [s["id"] for s in students]
    rows = await db.attendance.find({"date": d, "student_id": {"$in": ids}}, {"_id": 0}).to_list(1000)
    by_id = {r["student_id"]: r for r in rows}
    return [{"student": s, "record": by_id.get(s["id"], {"status": "UNMARKED", "date": d, "student_id": s["id"], "remarks": "", "batch_id": s.get("batch_id","")})} for s in students]

@api.post("/admin/attendance")
async def admin_save_attendance(data: AttendanceInput, user=Depends(require("admin"))):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["marked_by"] = user["id"]
    if not doc.get("batch_id"):
        s = await db.students.find_one({"id": data.student_id}, {"_id": 0, "batch_id": 1})
        doc["batch_id"] = (s or {}).get("batch_id", "")
    await db.attendance.update_one({"student_id": data.student_id, "date": data.date}, {"$set": doc}, upsert=True)
    return doc

# ===== Admin: fees =====
@api.get("/admin/fees")
async def admin_fees(status: str = "", user=Depends(require("admin"))):
    q = {"status": status} if status else {}
    rows = await db.fees.find(q, {"_id": 0}).sort("due_date", 1).to_list(3000)
    ids = list({r["student_id"] for r in rows})
    students = await db.students.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "student_name": 1, "father_guardian_phone": 1}).to_list(3000)
    by_id = {s["id"]: s for s in students}
    return [{**r, "student_name": by_id.get(r["student_id"], {}).get("student_name", "Student"), "guardian_phone": by_id.get(r["student_id"], {}).get("father_guardian_phone", "")} for r in rows]

@api.post("/admin/fees/pay")
async def admin_pay(data: PaymentInput, user=Depends(require("admin"))):
    fee = await db.fees.find_one({"id": data.fee_id}, {"_id": 0})
    if not fee: raise HTTPException(404, "Fee record not found")
    paid = round(min(fee["monthly_fee_amount"], fee.get("paid_amount", 0) + data.amount), 2)
    status_val = "PAID" if paid >= fee["monthly_fee_amount"] else "PARTIAL"
    receipt = fee.get("receipt_number") or new_receipt()
    await db.fees.update_one({"id": data.fee_id}, {"$set": {"paid_amount": paid, "status": status_val, "payment_date": today_iso(), "payment_mode": data.payment_mode, "receipt_number": receipt}})
    student = await db.students.find_one({"id": fee["student_id"]}, {"_id": 0}) or {}
    return {**fee, "paid_amount": paid, "status": status_val, "payment_date": today_iso(), "payment_mode": data.payment_mode, "receipt_number": receipt, "student_name": student.get("student_name", "Student")}

@api.post("/admin/fees/generate")
async def admin_generate_fees(user=Depends(require("admin"))):
    month = date.today().strftime("%Y-%m")
    due = second_sunday(date.today().year, date.today().month).isoformat()
    students = await db.students.find({"status": "ACTIVE"}, {"_id": 0}).to_list(2000)
    created = 0
    for s in students:
        if await db.fees.find_one({"student_id": s["id"], "month_year": month}): continue
        await db.fees.insert_one({"id": str(uuid.uuid4()), "student_id": s["id"], "month_year": month, "monthly_fee_amount": s.get("monthly_fee", 1800), "due_date": due, "paid_amount": 0, "status": "OVERDUE" if today_iso() > due else "DUE", "payment_date": "", "payment_mode": "", "receipt_number": ""})
        created += 1
    return {"created": created, "month": month, "due_date": due}

# ===== Teacher endpoints =====
@api.get("/teacher/batches")
async def teacher_batches(user=Depends(require("teacher"))):
    teacher = await db.teachers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not teacher: raise HTTPException(404, "Teacher profile not found")
    batches = await db.batches.find({"teacher_id": teacher["id"]}, {"_id": 0}).sort("slot", 1).to_list(100)
    counts = {b["id"]: await db.students.count_documents({"batch_id": b["id"], "status": "ACTIVE"}) for b in batches}
    return {"teacher": teacher, "batches": [{**b, "enrolled_count": counts[b["id"]]} for b in batches]}

@api.get("/teacher/batches/{bid}/roster")
async def teacher_roster(bid: str, user=Depends(require("teacher"))):
    teacher = await db.teachers.find_one({"user_id": user["id"]}, {"_id": 0})
    batch = await db.batches.find_one({"id": bid, "teacher_id": teacher["id"] if teacher else ""}, {"_id": 0})
    if not batch: raise HTTPException(403, "Batch not assigned to you")
    students = await db.students.find({"batch_id": bid, "status": "ACTIVE"}, {"_id": 0}).sort("student_name", 1).to_list(200)
    return {"batch": batch, "students": students}

@api.get("/teacher/attendance")
async def teacher_get_attendance(batch_id: str, day: str = "", user=Depends(require("teacher"))):
    teacher = await db.teachers.find_one({"user_id": user["id"]}, {"_id": 0})
    batch = await db.batches.find_one({"id": batch_id, "teacher_id": teacher["id"] if teacher else ""}, {"_id": 0})
    if not batch: raise HTTPException(403, "Batch not assigned to you")
    d = day or today_iso()
    students = await db.students.find({"batch_id": batch_id, "status": "ACTIVE"}, {"_id": 0}).sort("student_name", 1).to_list(200)
    rows = await db.attendance.find({"date": d, "batch_id": batch_id}, {"_id": 0}).to_list(500)
    by_id = {r["student_id"]: r for r in rows}
    return {"batch": batch, "date": d, "rows": [{"student": s, "record": by_id.get(s["id"], {"status": "UNMARKED", "date": d, "student_id": s["id"], "batch_id": batch_id, "remarks": ""})} for s in students]}

@api.post("/teacher/attendance")
async def teacher_save_attendance(data: AttendanceInput, user=Depends(require("teacher"))):
    teacher = await db.teachers.find_one({"user_id": user["id"]}, {"_id": 0})
    batch = await db.batches.find_one({"id": data.batch_id, "teacher_id": teacher["id"] if teacher else ""}, {"_id": 0})
    if not batch: raise HTTPException(403, "Batch not assigned to you")
    student = await db.students.find_one({"id": data.student_id, "batch_id": data.batch_id}, {"_id": 0})
    if not student: raise HTTPException(404, "Student not in this batch")
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["marked_by"] = user["id"]
    await db.attendance.update_one({"student_id": data.student_id, "date": data.date}, {"$set": doc}, upsert=True)
    return doc

@api.get("/teacher/attendance/history")
async def teacher_history(batch_id: str, user=Depends(require("teacher"))):
    teacher = await db.teachers.find_one({"user_id": user["id"]}, {"_id": 0})
    batch = await db.batches.find_one({"id": batch_id, "teacher_id": teacher["id"] if teacher else ""}, {"_id": 0})
    if not batch: raise HTTPException(403, "Batch not assigned to you")
    return await db.attendance.find({"batch_id": batch_id}, {"_id": 0}).sort("date", -1).to_list(500)

# ===== Student endpoints =====
@api.get("/student/me")
async def student_me(user=Depends(require("student"))):
    user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    sid = user_doc.get("student_id") if user_doc else None
    if not sid: raise HTTPException(404, "Student profile not linked yet")
    return await _student_detail(sid)

# ===== Seed =====
async def seed():
    meta = await db.meta.find_one({"key": "seed_version"}, {"_id": 0})
    if meta and meta.get("version") == SEED_VERSION: return
    for c in ["users", "students", "applications", "teachers", "batches", "attendance", "fees", "login_attempts"]:
        await db[c].delete_many({})

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    await db.users.insert_one({"id": "user-admin", "email": admin_email, "name": "Sanskritika Mirza", "role": "admin", "phone": "", "status": "ACTIVE", "password_hash": hash_pw(admin_pw), "must_change_password": False, "created_at": now_iso()})

    teacher_seed = [
        ("user-t1", "guitar.teacher@sanskritika.in", "Rohan Verma", ["Guitar"], "9810100001"),
        ("user-t2", "vocal.teacher@sanskritika.in", "Priya Nair", ["Vocal", "Piano Keyboard"], "9810100002"),
    ]
    teachers = []
    for uid, email, name, spec, phone in teacher_seed:
        await db.users.insert_one({"id": uid, "email": email, "name": name, "role": "teacher", "phone": phone, "status": "ACTIVE", "password_hash": hash_pw("teacher123"), "must_change_password": False, "created_at": now_iso()})
        tid = "teacher-" + uid[-2:]
        t = {"id": tid, "user_id": uid, "name": name, "email": email, "phone": phone, "specialization": spec, "status": "ACTIVE", "hire_date": today_iso()}
        await db.teachers.insert_one(t)
        teachers.append(t)

    batch_seed = [
        ("batch-g1", "Guitar Ensemble", "Guitar", "8:00 AM - 9:30 AM", teachers[0]["id"]),
        ("batch-g2", "Guitar Intermediate", "Guitar", "11:00 AM - 12:30 PM", teachers[0]["id"]),
        ("batch-v1", "Vocal Circle", "Vocal", "9:30 AM - 11:00 AM", teachers[1]["id"]),
        ("batch-p1", "Piano Studio", "Piano Keyboard", "12:30 PM - 2:00 PM", teachers[1]["id"]),
    ]
    batches = []
    for bid, name, inst, slot, tid in batch_seed:
        b = {"id": bid, "name": name, "instrument": inst, "slot": slot, "teacher_id": tid, "capacity": 12, "day_of_week": "Sunday"}
        await db.batches.insert_one(b)
        batches.append(b)

    student_seed = [
        ("Aarav Mehta", "MALE", "2012-04-11", 0),
        ("Diya Sharma", "FEMALE", "2011-06-22", 2),
        ("Kabir Rao", "MALE", "2010-03-14", 1),
        ("Meera Iyer", "FEMALE", "2013-08-05", 3),
        ("Vihaan Kapoor", "MALE", "2012-12-19", 0),
        ("Anaya Das", "FEMALE", "2011-09-30", 2),
        ("Rohan Sen", "MALE", "2010-11-14", 1),
        ("Ishita Bose", "FEMALE", "2012-02-04", 3),
    ]
    due = second_sunday(date.today().year, date.today().month).isoformat()
    month = date.today().strftime("%Y-%m")
    for i, (name, gender, dob, bidx) in enumerate(student_seed):
        uid = f"user-s{i+1}"
        sid = f"student-s{i+1}"
        email = f"student{i+1}@sanskritika.in"
        b = batches[bidx]
        await db.users.insert_one({"id": uid, "email": email, "name": name, "role": "student", "phone": f"98{10000000+i}", "status": "ACTIVE", "password_hash": hash_pw("student123"), "must_change_password": False, "created_at": now_iso(), "student_id": sid})
        s = {"id": sid, "user_id": uid, "application_id": "", "roll_number": f"SM2026{i+1:03d}", "student_name": name, "dob": dob, "gender": gender, "email": email, "address": "New Delhi", "father_guardian_name": f"Parent of {name}", "father_guardian_phone": f"98{10000000+i}", "mother_name": "", "mother_phone": "", "school_college_name": "Delhi Public School", "educational_qualification": "School student", "grade_class": "Grade 7", "prior_music_knowledge": "Beginner", "subjects": [b["instrument"]], "batch_id": b["id"], "sunday_batch_slot": b["slot"], "weekday_batch_slot": "", "monthly_fee": 1800, "status": "ACTIVE", "enrollment_type": "FRESH", "admission_date": today_iso(), "aim_of_learning": "Build a joyful, confident musical practice.", "photo_url": ""}
        await db.students.insert_one(s)
        paid = 1800 if i in (1, 4, 6) else (900 if i == 2 else 0)
        status_val = "PAID" if paid >= 1800 else ("PARTIAL" if paid > 0 else ("OVERDUE" if today_iso() > due else "DUE"))
        await db.fees.insert_one({"id": str(uuid.uuid4()), "student_id": sid, "month_year": month, "monthly_fee_amount": 1800, "due_date": due, "paid_amount": paid, "status": status_val, "payment_date": today_iso() if paid else "", "payment_mode": "UPI" if paid else "", "receipt_number": f"SM-{i+1:04d}" if paid else ""})
        await db.attendance.insert_one({"id": str(uuid.uuid4()), "student_id": sid, "batch_id": b["id"], "date": today_iso(), "status": "PRESENT" if i % 4 != 0 else "ABSENT", "remarks": "", "marked_by": b["teacher_id"]})

    for i, (name, gender, subj, slot, dob, email, phone, msg) in enumerate([
        ("Aditya Bhatt", "MALE", ["Drums"], "9:30 AM - 11:00 AM", "2013-01-10", "aditya@example.com", "9000000001", "I love rhythm and want to build a solid foundation."),
        ("Kiara Menon", "FEMALE", ["Violin"], "11:00 AM - 12:30 PM", "2012-09-24", "kiara@example.com", "9000000002", "Grew up around Indian classical music."),
    ]):
        await db.applications.insert_one({"id": f"app-p{i+1}", "tracking_id": f"SM-APP-2026-{200+i:03d}", "student_name": name, "dob": dob, "gender": gender, "father_guardian_name": f"Parent of {name}", "father_guardian_phone": phone, "mother_name": "", "mother_phone": "", "email": email, "address": "New Delhi", "school_college_name": "Bal Bharati", "educational_qualification": "School student", "grade_class": "Grade 8", "prior_music_knowledge": "Beginner", "subjects": subj, "preferred_sunday_slot": slot, "weekday_slot": "", "aim_of_learning": msg, "status": "PENDING", "rejection_reason": "", "created_at": now_iso(), "reviewed_at": "", "approved_by": "", "student_id": ""})

    await db.applications.insert_one({"id": "app-r1", "tracking_id": "SM-APP-2026-099", "student_name": "Rehaan Khan", "dob": "2014-02-05", "gender": "MALE", "father_guardian_name": "Parent of Rehaan", "father_guardian_phone": "9000123456", "mother_name": "", "mother_phone": "", "email": "rehaan@example.com", "address": "Noida", "school_college_name": "St. Xavier's", "educational_qualification": "Grade 6", "grade_class": "Grade 6", "prior_music_knowledge": "None", "subjects": ["Guitar"], "preferred_sunday_slot": "8:00 AM - 9:30 AM", "weekday_slot": "", "aim_of_learning": "Fun learning.", "status": "REJECTED", "rejection_reason": "Selected batch is currently full. Please reapply in the next term.", "created_at": now_iso(), "reviewed_at": now_iso(), "approved_by": "user-admin", "student_id": ""})

    await db.meta.update_one({"key": "seed_version"}, {"$set": {"key": "seed_version", "version": SEED_VERSION}}, upsert=True)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier", unique=True)
    await db.applications.create_index("tracking_id", unique=True)
    await db.students.create_index("roll_number", unique=True, sparse=True)
    await seed()

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ["CORS_ORIGINS"].split(","), allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
