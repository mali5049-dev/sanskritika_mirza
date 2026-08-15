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
from pydantic import BaseModel, Field

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Sanskritika Mirza Academy API")
api = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"

def now_iso(): return datetime.now(timezone.utc).isoformat()
def second_sunday(year: int, month: int):
    first = date(year, month, 1)
    return first + timedelta(days=(6 - first.weekday()) % 7 + 7)
def hash_password(value): return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()
def verify_password(value, hashed): return bcrypt.checkpw(value.encode(), hashed.encode())
def token_for(user):
    return jwt.encode({"sub": user["id"], "email": user["email"], "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

class LoginInput(BaseModel): email: str; password: str
class StudentInput(BaseModel):
    enrollment_type: str = "FRESH"; student_name: str; dob: Optional[str] = ""; gender: str = "OTHER"
    address: str = ""; father_guardian_name: str = ""; father_guardian_phone: str
    mother_name: str = ""; mother_phone: str = ""; email: str = ""; educational_qualification: str = ""
    school_college_name: str = ""; prior_music_knowledge: str = ""; subjects: List[str] = []
    grade_class: str = ""; sunday_batch_slot: str = "None / Custom"; weekday_batch_slot: str = ""
    aim_of_learning: str = ""; status: str = "ACTIVE"; photo_url: str = ""
class AttendanceInput(BaseModel): student_id: str; date: str; status: str; remarks: str = ""
class PaymentInput(BaseModel): fee_id: str; amount: float; payment_mode: str

async def current_user(request: Request):
    raw = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not raw: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(raw, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user: raise HTTPException(401, "Staff account not found")
        return user
    except jwt.PyJWTError: raise HTTPException(401, "Session expired")

@api.get("/")
async def root(): return {"message": "Sanskritika Mirza Academy API"}

@api.post("/auth/login")
async def login(data: LoginInput, response: Response, request: Request):
    email = data.email.lower(); identifier = f"{request.client.host if request.client else 'unknown'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("locked_until", "") > now_iso(): raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        failed = (attempt.get("failed", 0) if attempt else 0) + 1
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": {"identifier": identifier, "failed": failed, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat() if failed >= 5 else ""}}, upsert=True)
        raise HTTPException(401, "Incorrect email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    response.set_cookie("access_token", token_for(user), httponly=True, samesite="none", max_age=28800, secure=True)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

@api.get("/auth/me")
async def me(user=Depends(current_user)): return user

@api.post("/auth/logout")
async def logout(response: Response): response.delete_cookie("access_token"); return {"ok": True}

@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    students = await db.students.find({}, {"_id": 0}).to_list(1000)
    fees = await db.fees.find({}, {"_id": 0}).to_list(2000)
    attendance = await db.attendance.find({"date": date.today().isoformat()}, {"_id": 0}).to_list(1000)
    active = [s for s in students if s["status"] == "ACTIVE"]
    overdue = [f for f in fees if f["status"] == "OVERDUE"]
    paid = sum(f.get("paid_amount", 0) for f in fees)
    att_rate = round(100 * sum(a["status"] == "PRESENT" for a in attendance) / len(attendance)) if attendance else 0
    return {"total_students": len(active), "attendance_rate": att_rate, "overdue_count": len(overdue), "pending_amount": round(sum(f["monthly_fee_amount"]-f.get("paid_amount", 0) for f in fees if f["status"] != "PAID"), 2), "collected": paid, "action_required": overdue[:5], "students": students}

@api.get("/students")
async def students(subject: str = "", slot: str = "", status: str = "", user=Depends(current_user)):
    query = {}
    if subject: query["subjects"] = subject
    if slot: query["sunday_batch_slot"] = slot
    if status: query["status"] = status
    return await db.students.find(query, {"_id": 0}).sort("student_name", 1).to_list(1000)

@api.post("/students")
async def create_student(data: StudentInput, user=Depends(current_user)):
    doc = data.model_dump(); doc.update({"id": str(uuid.uuid4()), "admission_date": date.today().isoformat()})
    await db.students.insert_one(doc)
    return doc

@api.post("/students/{student_id}/renew")
async def renew_student(student_id: str, user=Depends(current_user)):
    result = await db.students.update_one({"id": student_id}, {"$set": {"enrollment_type": "RENEWAL", "admission_date": date.today().isoformat(), "status": "ACTIVE"}})
    if not result.matched_count: raise HTTPException(404, "Student not found")
    return await db.students.find_one({"id": student_id}, {"_id": 0})

@api.get("/students/{student_id}")
async def student_profile(student_id: str, user=Depends(current_user)):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student: raise HTTPException(404, "Student not found")
    return {"student": student, "attendance": await db.attendance.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(500), "fees": await db.fees.find({"student_id": student_id}, {"_id": 0}).sort("month_year", -1).to_list(100)}

@api.get("/attendance")
async def attendance(day: str = "", slot: str = "", user=Depends(current_user)):
    query = {"date": day or date.today().isoformat()}
    rows = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    students = await db.students.find({"status": "ACTIVE", **({"sunday_batch_slot": slot} if slot else {})}, {"_id": 0}).to_list(1000)
    by_id = {r["student_id"]: r for r in rows}
    return [{"student": s, "record": by_id.get(s["id"], {"status": "UNMARKED", "date": query["date"], "student_id": s["id"]})} for s in students]

@api.post("/attendance")
async def save_attendance(data: AttendanceInput, user=Depends(current_user)):
    doc = data.model_dump(); doc["id"] = str(uuid.uuid4())
    await db.attendance.update_one({"student_id": data.student_id, "date": data.date}, {"$set": doc}, upsert=True)
    return doc

@api.get("/fees")
async def fees(status: str = "", user=Depends(current_user)):
    rows = await db.fees.find({**({"status": status} if status else {})}, {"_id": 0}).sort("due_date", 1).to_list(2000)
    ids = [r["student_id"] for r in rows]
    students = await db.students.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "student_name": 1}).to_list(2000)
    names = {s["id"]: s["student_name"] for s in students}
    return [{**r, "student_name": names.get(r["student_id"], "Student")} for r in rows]

@api.post("/fees/pay")
async def pay_fee(data: PaymentInput, user=Depends(current_user)):
    fee = await db.fees.find_one({"id": data.fee_id}, {"_id": 0})
    if not fee: raise HTTPException(404, "Fee record not found")
    paid = round(min(fee["monthly_fee_amount"], fee.get("paid_amount", 0) + data.amount), 2)
    status = "PAID" if paid >= fee["monthly_fee_amount"] else "PARTIAL"
    receipt = fee.get("receipt_number") or f"SM-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:5].upper()}"
    await db.fees.update_one({"id": data.fee_id}, {"$set": {"paid_amount": paid, "status": status, "payment_date": date.today().isoformat(), "payment_mode": data.payment_mode, "receipt_number": receipt}})
    return {**fee, "paid_amount": paid, "status": status, "payment_date": date.today().isoformat(), "payment_mode": data.payment_mode, "receipt_number": receipt}

async def seed():
    email, password = os.environ["ADMIN_EMAIL"].lower(), os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    user = {"id": "staff-1", "email": email, "name": "Sanskritika Mirza", "role": "staff", "password_hash": hash_password(password)}
    if not existing: await db.users.insert_one(user)
    else: await db.users.update_one({"email": email}, {"$set": {"password_hash": user["password_hash"], "name": user["name"], "role": "staff", "id": "staff-1"}})
    if await db.students.count_documents({}) > 0: return
    names = [("Aarav Mehta", ["Piano Keyboard"], "8:00 AM - 9:30 AM", "MALE"), ("Diya Sharma", ["Vocal"], "9:30 AM - 11:00 AM", "FEMALE"), ("Kabir Rao", ["Guitar"], "11:00 AM - 12:30 PM", "MALE"), ("Meera Iyer", ["Violin"], "12:30 PM - 2:00 PM", "FEMALE"), ("Vihaan Kapoor", ["Tabla"], "8:00 AM - 9:30 AM", "MALE"), ("Anaya Das", ["Drums"], "9:30 AM - 11:00 AM", "FEMALE"), ("Rohan Sen", ["Vocal", "Guitar"], "11:00 AM - 12:30 PM", "MALE"), ("Ishita Bose", ["Piano Keyboard"], "None / Custom", "FEMALE")]
    docs=[]
    for i,(name, subjects, slot, gender) in enumerate(names):
        sid=str(uuid.uuid4()); docs.append({"id": sid, "enrollment_type": "FRESH", "student_name": name, "dob": "2012-04-12", "gender": gender, "address": "New Delhi", "father_guardian_name": "Parent of "+name, "father_guardian_phone": f"98{10000000+i}", "mother_name": "", "mother_phone": "", "email": "", "educational_qualification": "School student", "school_college_name": "Delhi Public School", "prior_music_knowledge": "Beginner", "subjects": subjects, "grade_class": "Grade 7", "sunday_batch_slot": slot, "weekday_batch_slot": "Tuesday · 5:00 PM", "aim_of_learning": "Build a joyful, confident musical practice.", "status": "ACTIVE", "photo_url": "", "admission_date": date.today().isoformat()})
    await db.students.insert_many(docs)
    due = second_sunday(date.today().year, date.today().month).isoformat(); month=date.today().strftime("%Y-%m")
    for i,s in enumerate(docs):
        paid = 1800 if i in (1,4,6) else 0; status="PAID" if paid else ("OVERDUE" if date.today().isoformat() > due else "DUE")
        await db.fees.insert_one({"id": str(uuid.uuid4()), "student_id": s["id"], "month_year": month, "monthly_fee_amount": 1800, "due_date": due, "paid_amount": paid, "status": status, "payment_date": date.today().isoformat() if paid else "", "payment_mode": "UPI" if paid else "", "receipt_number": f"SM-{i+1:04d}" if paid else ""})
    for i,s in enumerate(docs): await db.attendance.insert_one({"id": str(uuid.uuid4()), "student_id": s["id"], "date": date.today().isoformat(), "status": "PRESENT" if i % 4 != 0 else "ABSENT", "remarks": ""})

@app.on_event("startup")
async def startup():
    await db.login_attempts.create_index("identifier", unique=True)
    await seed()
app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ["CORS_ORIGINS"].split(","), allow_methods=["*"], allow_headers=["*"])
@app.on_event("shutdown")
async def shutdown(): client.close()