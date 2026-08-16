import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Check, ChevronRight, ClipboardCheck, GraduationCap, Inbox, LayoutDashboard, LogOut, Menu, MessageCircle, Music2, Plus, Receipt, Search, Sparkles, UserPlus, UsersRound, WalletCards, X } from "lucide-react";
import { client, formatError, money, SUNDAY_SLOTS, INSTRUMENTS, useAuth } from "@/api";

const NAV = [
  { to: "/admin", label: "Overview", testId: "admin-nav-overview", icon: LayoutDashboard, end: true },
  { to: "/admin/applications", label: "Applications", testId: "admin-nav-applications", icon: Inbox },
  { to: "/admin/students", label: "Students", testId: "admin-nav-students", icon: UsersRound },
  { to: "/admin/teachers", label: "Teachers", testId: "admin-nav-teachers", icon: GraduationCap },
  { to: "/admin/batches", label: "Batches", testId: "admin-nav-batches", icon: Music2 },
  { to: "/admin/attendance", label: "Attendance", testId: "admin-nav-attendance", icon: ClipboardCheck },
  { to: "/admin/fees", label: "Fees & dues", testId: "admin-nav-fees", icon: WalletCards },
];

function PageName() {
  const l = useLocation();
  const found = NAV.slice().reverse().find((n) => l.pathname === n.to || (!n.end && l.pathname.startsWith(n.to)));
  return found ? found.label : "Overview";
}

function Loading() { return <div className="loading"><Music2 size={22} /><span>Loading…</span></div>; }

function Header({ eyebrow, title, description, action }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth();
  const [mobile, setMobile] = useState(false);
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <NavLink to="/admin" className="logo" data-testid="admin-logo">
          <div className="logo-icon"><Music2 size={20} /></div>
          <div><strong>Sanskritika<br />Mirza</strong><span>ADMIN CONSOLE</span></div>
        </NavLink>
        <nav>
          {NAV.map(({ to, label, testId, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} data-testid={testId} onClick={() => setMobile(false)} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-note"><Sparkles size={15} /><span>"Music is the<br />language of the soul."</span></div>
          <button className="logout" onClick={logout} data-testid="admin-logout-button"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobile(!mobile)} data-testid="admin-mobile-menu"><Menu size={20} /></button>
          <div className="breadcrumb">Academy <ChevronRight size={14} /> <b><PageName /></b></div>
          <div className="profile"><div className="avatar">{user?.name?.[0] || "A"}</div><div><b>{user?.name}</b><span>Administrator</span></div></div>
        </header>
        <div className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="applications" element={<Applications />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentProfile />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="batches" element={<Batches />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="fees" element={<Fees />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

/* ================= DASHBOARD ================= */
function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { client.get("/admin/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Loading />;
  return (
    <>
      <Header eyebrow="ADMIN OVERVIEW" title={<>Good day, <i>Sanskritika.</i></>} description="Here's the pulse of the academy today." action={<NavLink data-testid="dashboard-view-applications-button" className="primary-btn" to="/admin/applications"><Inbox size={17} /> Review applications</NavLink>} />
      <div className="stats-grid">
        <Stat testId="stat-students" label="Active students" value={data.total_students} detail="Across all disciplines" icon={<UsersRound />} tone="ochre" />
        <Stat testId="stat-attendance" label="Today's attendance" value={`${data.attendance_rate}%`} detail="Marked sessions" icon={<ClipboardCheck />} tone="sage" />
        <Stat testId="stat-pending" label="Pending applications" value={data.pending_applications} detail="Awaiting your review" icon={<Inbox />} tone="blue" />
        <Stat testId="stat-outstanding" label="Fees outstanding" value={money(data.pending_amount)} detail={`${data.overdue_count} overdue accounts`} icon={<WalletCards />} tone="rose" />
      </div>
      <div className="dashboard-grid">
        <section className="panel action-panel">
          <div className="panel-head">
            <div><div className="eyebrow">NEEDS YOUR EYE</div><h3>Action required</h3></div>
            <NavLink data-testid="dashboard-view-fees-link" to="/admin/fees" className="text-link">View all <ArrowUpRight size={15} /></NavLink>
          </div>
          {data.action_required.length ? (
            <div className="action-list">
              {data.action_required.map((f) => (
                <div className="action-row" key={f.id}>
                  <div className="initial">{f.student_name?.[0] || "?"}</div>
                  <div><b>{f.student_name}</b><span>Monthly tuition · Due {f.due_date}</span></div>
                  <strong>{money(f.monthly_fee_amount - f.paid_amount)}</strong>
                  <NavLink data-testid={`action-fee-${f.id}`} to="/admin/fees"><ArrowUpRight size={16} /></NavLink>
                </div>
              ))}
            </div>
          ) : (<div className="empty">You're all caught up for today.</div>)}
        </section>
        <section className="panel disciplines">
          <div className="eyebrow">THE STUDIO</div>
          <h3>What's being learned</h3>
          <div className="discipline-list">
            {INSTRUMENTS.filter((x) => x !== "Others").map((x, i) => (
              <div className="discipline" key={x}>
                <span className={`disc-icon d${i}`}>{["♬", "◉", "♢", "♩", "◌", "✦"][i]}</span>
                <div><b>{x}</b><span>{data.students.filter((s) => (s.subjects || []).includes(x)).length} active students</span></div>
                <div className="bar"><i style={{ width: `${Math.min(100, 20 + data.students.filter((s) => (s.subjects || []).includes(x)).length * 15)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, detail, icon, tone, testId }) {
  return (
    <div className={`stat ${tone}`} data-testid={testId}>
      <div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div>
      <strong>{value}</strong><small>{detail}</small>
    </div>
  );
}

/* ================= APPLICATIONS ================= */
function Applications() {
  const [status, setStatus] = useState("PENDING");
  const [apps, setApps] = useState([]);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [approvedResult, setApprovedResult] = useState(null);
  const [batches, setBatches] = useState([]);

  const load = () => client.get("/admin/applications", { params: { status } }).then((r) => setApps(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { client.get("/admin/batches").then((r) => setBatches(r.data)); }, []);

  return (
    <>
      <Header eyebrow="ADMISSIONS" title="Applications." description="Review new applicants and onboard them after offline verification." />
      <div className="fee-tabs">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} data-testid={`applications-filter-${s.toLowerCase()}`} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>{s[0] + s.slice(1).toLowerCase()}</button>
        ))}
      </div>
      <section className="panel apps-list">
        {apps.length === 0 && <div className="empty">No {status.toLowerCase()} applications right now.</div>}
        {apps.map((a) => (
          <div className="app-row" key={a.id}>
            <div className="app-main">
              <div className="app-title"><b>{a.student_name}</b><span className={`badge ${a.status.toLowerCase()}`}>{a.status}</span></div>
              <div className="app-meta">
                <span>Tracking · <b>{a.tracking_id}</b></span>
                <span>Instrument · <b>{(a.subjects || []).join(", ") || "—"}</b></span>
                <span>Preferred slot · <b>{a.preferred_sunday_slot || "—"}</b></span>
                <span>Guardian · <b>{a.father_guardian_phone}</b></span>
              </div>
              {a.aim_of_learning && <p className="app-aim">"{a.aim_of_learning}"</p>}
              {a.status === "REJECTED" && a.rejection_reason && <p className="app-rejection">Rejected: {a.rejection_reason}</p>}
            </div>
            {a.status === "PENDING" && (
              <div className="app-actions">
                <button className="primary-btn" onClick={() => setApproving(a)} data-testid={`approve-app-${a.id}`}><Check size={15} /> Approve</button>
                <button className="secondary-btn" onClick={() => setRejecting(a)} data-testid={`reject-app-${a.id}`}><X size={15} /> Reject</button>
              </div>
            )}
          </div>
        ))}
      </section>
      {approving && <ApproveModal app={approving} batches={batches} onClose={() => setApproving(null)} onSaved={(r) => { setApproving(null); setApprovedResult(r); load(); }} />}
      {rejecting && <RejectModal app={rejecting} onClose={() => setRejecting(null)} onSaved={() => { setRejecting(null); load(); }} />}
      {approvedResult && <ApprovedResultModal result={approvedResult} onClose={() => setApprovedResult(null)} />}
    </>
  );
}

function ApproveModal({ app, batches, onClose, onSaved }) {
  const [form, setForm] = useState({ roll_number: `SM${new Date().getFullYear()}${Math.floor(100 + Math.random() * 900)}`, batch_id: batches[0]?.id || "", monthly_fee: 1800, temp_password: `sm${Math.floor(1000 + Math.random() * 9000)}`, initial_payment: 0, payment_mode: "CASH" });
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await client.post(`/admin/applications/${app.id}/approve`, { ...form, monthly_fee: Number(form.monthly_fee), initial_payment: Number(form.initial_payment) });
      toast.success("Application approved");
      onSaved(data);
    } catch (err) {
      toast.error(formatError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={onClose} data-testid="close-approve-modal"><X /></button>
        <div className="eyebrow">APPROVE APPLICATION</div>
        <h2>Onboard {app.student_name}.</h2>
        <p className="muted">Assign a roll number, batch and initial fee. A student login will be created.</p>
        <form className="form-grid" onSubmit={submit}>
          <label>Roll number<input data-testid="approve-roll-number" value={form.roll_number} onChange={(e) => update("roll_number", e.target.value)} required /></label>
          <label>Batch<select data-testid="approve-batch" value={form.batch_id} onChange={(e) => update("batch_id", e.target.value)} required>
            <option value="">Choose batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.slot}</option>)}
          </select></label>
          <label>Monthly fee (₹)<input data-testid="approve-fee" type="number" value={form.monthly_fee} onChange={(e) => update("monthly_fee", e.target.value)} required /></label>
          <label>Temporary password<input data-testid="approve-password" value={form.temp_password} onChange={(e) => update("temp_password", e.target.value)} required /></label>
          <label>Initial payment collected (₹)<input data-testid="approve-initial-payment" type="number" value={form.initial_payment} onChange={(e) => update("initial_payment", e.target.value)} /></label>
          <label>Payment mode<select data-testid="approve-payment-mode" value={form.payment_mode} onChange={(e) => update("payment_mode", e.target.value)}>{["CASH", "UPI", "CARD", "BANK_TRANSFER"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <button className="primary-btn wide" type="submit" disabled={busy || !form.batch_id} data-testid="approve-submit-button">{busy ? "Approving…" : "Confirm approval"} <ArrowUpRight size={16} /></button>
        </form>
      </div>
    </div>
  );
}

function RejectModal({ app, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.post(`/admin/applications/${app.id}/reject`, { reason });
      toast.success("Application rejected");
      onSaved();
    } catch (err) { toast.error(formatError(err)); } finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal small-modal">
        <button className="modal-close" onClick={onClose} data-testid="close-reject-modal"><X /></button>
        <div className="eyebrow">REJECT APPLICATION</div>
        <h2>Share a reason.</h2>
        <p className="muted">This message is shown when {app.student_name} tracks their status.</p>
        <form onSubmit={submit}>
          <label>Reason<textarea data-testid="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} required rows="4" placeholder="e.g. Selected batch is currently full. Please reapply in the next term." /></label>
          <button className="primary-btn full" type="submit" disabled={busy || !reason.trim()} data-testid="reject-submit-button">{busy ? "Saving…" : "Confirm rejection"}</button>
        </form>
      </div>
    </div>
  );
}

function ApprovedResultModal({ result, onClose }) {
  const copy = () => { navigator.clipboard.writeText(`Email: ${result.user_email}\nPassword: ${result.temp_password}\nRoll: ${result.roll_number}`); toast.success("Credentials copied"); };
  return (
    <div className="modal-backdrop">
      <div className="modal small-modal">
        <button className="modal-close" onClick={onClose} data-testid="close-approved-result"><X /></button>
        <div className="eyebrow">STUDENT ONBOARDED</div>
        <h2>Share these credentials.</h2>
        <p className="muted">The student will be asked to change the password at first login.</p>
        <div className="credentials-box" data-testid="approved-credentials">
          <div><span>Roll number</span><b>{result.roll_number}</b></div>
          <div><span>Email</span><b>{result.user_email}</b></div>
          <div><span>Temporary password</span><b>{result.temp_password}</b></div>
          <div><span>Batch</span><b>{result.batch}</b></div>
        </div>
        <div className="receipt-actions">
          <button className="primary-btn" onClick={copy} data-testid="copy-credentials-button">Copy credentials</button>
          <button className="secondary-btn" onClick={onClose} data-testid="approved-done-button">Done</button>
        </div>
      </div>
    </div>
  );
}

/* ================= STUDENTS ================= */
function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState("");
  const load = () => client.get("/admin/students", { params: { slot } }).then((r) => setStudents(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slot]);
  const shown = students.filter((s) => s.student_name.toLowerCase().includes(search.toLowerCase()) || (s.subjects || []).join(" ").toLowerCase().includes(search.toLowerCase()) || (s.roll_number || "").toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <Header eyebrow="STUDENT DIRECTORY" title="The student book." description={`${students.length} learners on the roll.`} action={<NavLink className="primary-btn" to="/admin/applications" data-testid="students-add-button"><UserPlus size={17} /> New via applications</NavLink>} />
      <div className="toolbar">
        <div className="search"><Search size={17} /><input data-testid="student-search-input" placeholder="Search name, roll number, or instrument" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select data-testid="student-slot-filter" value={slot} onChange={(e) => setSlot(e.target.value)}>
          <option value="">All Sunday batches</option>
          {SUNDAY_SLOTS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="student-grid">
        {shown.map((s) => (
          <NavLink data-testid={`student-card-${s.id}`} to={`/admin/students/${s.id}`} className="student-card" key={s.id}>
            <div className="student-avatar">{s.student_name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div>
            <div className="student-info">
              <div className="status-dot">● {s.status}</div>
              <h3>{s.student_name}</h3>
              <span>{(s.subjects || []).join(" · ")}</span>
              <small>{s.roll_number} · {s.sunday_batch_slot}</small>
            </div>
            <ArrowUpRight className="card-arrow" size={17} />
          </NavLink>
        ))}
      </div>
    </>
  );
}

function StudentProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => { client.get(`/admin/students/${id}`).then((r) => setData(r.data)); }, [id]);
  if (!data) return <Loading />;
  const s = data.student;
  const renew = async () => {
    try {
      await client.post(`/admin/students/${id}/renew`);
      setData({ ...data, student: { ...s, enrollment_type: "RENEWAL", status: "ACTIVE" } });
      toast.success("Enrollment marked as renewal");
    } catch (err) { toast.error(formatError(err)); }
  };
  return (
    <>
      <NavLink className="back-link" to="/admin/students" data-testid="profile-back-link">← All students</NavLink>
      <Header eyebrow="STUDENT PROFILE" title={s.student_name} description={`${(s.subjects || []).join(" · ")} · ${s.sunday_batch_slot}`} action={<button className="secondary-btn" onClick={renew} data-testid="profile-renew-button">Mark renewal</button>} />
      <div className="profile-grid">
        <section className="panel profile-about">
          <div className="large-avatar">{s.student_name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div>
          <h3>About the learner</h3>
          <Info label="Roll number" value={s.roll_number || "—"} />
          <Info label="Guardian" value={s.father_guardian_name || "Not added"} />
          <Info label="Phone" value={s.father_guardian_phone} />
          <Info label="Batch" value={data.batch ? `${data.batch.name} · ${data.batch.slot}` : "Unassigned"} />
          <Info label="Assigned teacher" value={data.teacher?.name || "Unassigned"} />
          <Info label="Enrollment" value={`${s.enrollment_type} · ${s.status}`} />
          <Info label="Monthly fee" value={money(s.monthly_fee)} />
          <Info label="Learning aim" value={s.aim_of_learning || "Not added"} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div><div className="eyebrow">RECENT RECORD</div><h3>Attendance history</h3></div>
            <span className="pill sage-pill">{data.attendance.filter((a) => a.status === "PRESENT").length} present</span>
          </div>
          <div className="history">
            {data.attendance.slice(0, 8).map((a) => (
              <div key={a.id || a.date} className="history-row"><span>{a.date}</span><b className={a.status.toLowerCase()}>{a.status}</b></div>
            ))}
            {!data.attendance.length && <div className="empty">No sessions recorded yet.</div>}
          </div>
          <div className="panel-head fee-head"><div><div className="eyebrow">LEDGER</div><h3>Fee history</h3></div></div>
          {data.fees.map((f) => (
            <div className="history-row" key={f.id}><span>{f.month_year}</span><span>{money(f.paid_amount)} / {money(f.monthly_fee_amount)}</span><b className={f.status.toLowerCase()}>{f.status}</b></div>
          ))}
          {!data.fees.length && <div className="empty">No fee records yet.</div>}
        </section>
      </div>
    </>
  );
}

function Info({ label, value }) { return <div className="info"><span>{label}</span><b>{value}</b></div>; }

/* ================= TEACHERS ================= */
function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [show, setShow] = useState(false);
  const load = () => client.get("/admin/teachers").then((r) => setTeachers(r.data));
  useEffect(() => { load(); }, []);
  const toggleStatus = async (t) => {
    try {
      await client.patch(`/admin/teachers/${t.id}`, { status: t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success("Teacher updated"); load();
    } catch (err) { toast.error(formatError(err)); }
  };
  return (
    <>
      <Header eyebrow="ACADEMY TEACHERS" title="Teachers on the roll." description={`${teachers.length} teachers guiding your studios.`} action={<button className="primary-btn" onClick={() => setShow(true)} data-testid="add-teacher-button"><Plus size={17} /> Add teacher</button>} />
      <section className="panel teachers-grid">
        {teachers.map((t) => (
          <div className="teacher-card" key={t.id} data-testid={`teacher-card-${t.id}`}>
            <div className="teacher-avatar">{t.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div>
            <div className="teacher-info">
              <div className="status-dot">● {t.status}</div>
              <h3>{t.name}</h3>
              <span>{t.specialization.join(" · ")}</span>
              <small>{t.email} · {t.phone}</small>
            </div>
            <button className="secondary-btn" onClick={() => toggleStatus(t)} data-testid={`toggle-teacher-${t.id}`}>{t.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
          </div>
        ))}
        {!teachers.length && <div className="empty">Add your first teacher to start assigning batches.</div>}
      </section>
      {show && <AddTeacherModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </>
  );
}

function AddTeacherModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: `teach${Math.floor(1000 + Math.random() * 9000)}`, specialization: [INSTRUMENTS[0]] });
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm({ ...form, [k]: v });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await client.post("/admin/teachers", form); toast.success("Teacher added"); onSaved(); }
    catch (err) { toast.error(formatError(err)); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={onClose} data-testid="close-add-teacher"><X /></button>
        <div className="eyebrow">NEW TEACHER</div>
        <h2>Bring a teacher on board.</h2>
        <p className="muted">They'll get a login to manage their batches and mark attendance.</p>
        <form className="form-grid" onSubmit={submit}>
          <label>Full name<input data-testid="teacher-name" value={form.name} onChange={(e) => update("name", e.target.value)} required /></label>
          <label>Email<input data-testid="teacher-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></label>
          <label>Phone<input data-testid="teacher-phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label>
          <label>Temporary password<input data-testid="teacher-password" value={form.password} onChange={(e) => update("password", e.target.value)} required /></label>
          <label className="wide">Specialization<select multiple data-testid="teacher-specialization" value={form.specialization} onChange={(e) => update("specialization", Array.from(e.target.selectedOptions).map((o) => o.value))}>{INSTRUMENTS.map((x) => <option key={x}>{x}</option>)}</select><small className="hint">Hold Ctrl/Cmd to select multiple.</small></label>
          <button className="primary-btn wide" type="submit" disabled={busy} data-testid="teacher-submit">{busy ? "Adding…" : "Add teacher"} <ArrowUpRight size={16} /></button>
        </form>
      </div>
    </div>
  );
}

/* ================= BATCHES ================= */
function Batches() {
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [show, setShow] = useState(false);
  const load = () => Promise.all([client.get("/admin/batches"), client.get("/admin/teachers")]).then(([b, t]) => { setBatches(b.data); setTeachers(t.data.filter((x) => x.status === "ACTIVE")); });
  useEffect(() => { load(); }, []);
  return (
    <>
      <Header eyebrow="BATCH ORCHESTRATION" title="Batches & schedules." description={`${batches.length} batches across the week.`} action={<button className="primary-btn" onClick={() => setShow(true)} data-testid="add-batch-button" disabled={!teachers.length}><Plus size={17} /> New batch</button>} />
      <section className="panel batch-list">
        {batches.map((b) => (
          <div className="batch-row" key={b.id} data-testid={`batch-row-${b.id}`}>
            <div><b>{b.name}</b><span>{b.instrument}</span></div>
            <div><span className="eyebrow">DAY / TIME</span><b>{b.day_of_week} · {b.slot}</b></div>
            <div><span className="eyebrow">TEACHER</span><b>{b.teacher_name}</b></div>
            <div><span className="eyebrow">ENROLLED</span><b>{b.enrolled_count} / {b.capacity}</b></div>
          </div>
        ))}
        {!batches.length && <div className="empty">Add teachers first, then create batches.</div>}
      </section>
      {show && <AddBatchModal teachers={teachers} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </>
  );
}

function AddBatchModal({ teachers, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", instrument: INSTRUMENTS[0], slot: SUNDAY_SLOTS[0], teacher_id: teachers[0]?.id || "", capacity: 12, day_of_week: "Sunday" });
  const update = (k, v) => setForm({ ...form, [k]: v });
  const submit = async (e) => {
    e.preventDefault();
    try { await client.post("/admin/batches", { ...form, capacity: Number(form.capacity) }); toast.success("Batch created"); onSaved(); }
    catch (err) { toast.error(formatError(err)); }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={onClose} data-testid="close-add-batch"><X /></button>
        <div className="eyebrow">NEW BATCH</div>
        <h2>Open a new studio slot.</h2>
        <form className="form-grid" onSubmit={submit}>
          <label>Batch name<input data-testid="batch-name" value={form.name} onChange={(e) => update("name", e.target.value)} required placeholder="e.g. Guitar Foundations" /></label>
          <label>Instrument<select data-testid="batch-instrument" value={form.instrument} onChange={(e) => update("instrument", e.target.value)}>{INSTRUMENTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Day<select data-testid="batch-day" value={form.day_of_week} onChange={(e) => update("day_of_week", e.target.value)}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Slot<select data-testid="batch-slot" value={form.slot} onChange={(e) => update("slot", e.target.value)}>{SUNDAY_SLOTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Teacher<select data-testid="batch-teacher" value={form.teacher_id} onChange={(e) => update("teacher_id", e.target.value)} required>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Capacity<input data-testid="batch-capacity" type="number" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} /></label>
          <button className="primary-btn wide" type="submit" data-testid="batch-submit">Create batch <ArrowUpRight size={16} /></button>
        </form>
      </div>
    </div>
  );
}

/* ================= ATTENDANCE ================= */
function Attendance() {
  const [rows, setRows] = useState([]);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState("");
  const load = () => client.get("/admin/attendance", { params: { day, slot } }).then((r) => setRows(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [day, slot]);
  const mark = async (row, status) => {
    try {
      await client.post("/admin/attendance", { student_id: row.student.id, batch_id: row.student.batch_id || "", date: day, status, remarks: "" });
      setRows((prev) => prev.map((x) => (x.student.id === row.student.id ? { ...x, record: { ...x.record, status } } : x)));
      toast.success("Attendance saved");
    } catch (err) { toast.error(formatError(err)); }
  };
  const present = rows.filter((x) => x.record.status === "PRESENT").length;
  return (
    <>
      <Header eyebrow="DAILY REGISTER" title="Take attendance." description="A calm, quick view of every learner in the room." action={<button className="primary-btn" onClick={() => Promise.all(rows.map((r) => mark(r, "PRESENT")))} data-testid="mark-all-present-button"><Check size={17} /> Mark all present</button>} />
      <div className="attendance-controls">
        <label>Date<input data-testid="attendance-date-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label>Session<select data-testid="attendance-slot-filter" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">All Sunday batches</option>{SUNDAY_SLOTS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <div className="attendance-summary"><b>{present} <span>present</span></b><b>{rows.length - present} <span>to mark</span></b></div>
      </div>
      <section className="panel register">
        <div className="register-head"><span>Learner</span><span>Instrument</span><span>Mark status</span></div>
        {rows.map((r) => (
          <div className="register-row" key={r.student.id}>
            <div className="row-student"><div className="tiny-avatar">{r.student.student_name[0]}</div><b>{r.student.student_name}</b></div>
            <span>{(r.student.subjects || []).join(" · ")}</span>
            <div className="attendance-actions">
              <button data-testid={`attendance-present-${r.student.id}`} className={r.record.status === "PRESENT" ? "selected present" : ""} onClick={() => mark(r, "PRESENT")}><Check size={15} /> Present</button>
              <button data-testid={`attendance-absent-${r.student.id}`} className={r.record.status === "ABSENT" ? "selected absent" : ""} onClick={() => mark(r, "ABSENT")}><X size={15} /> Absent</button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="empty">No active students for this slot.</div>}
      </section>
    </>
  );
}

/* ================= FEES ================= */
function Fees() {
  const [fees, setFees] = useState([]);
  const [filter, setFilter] = useState("");
  const [pay, setPay] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const load = () => client.get("/admin/fees", { params: { status: filter } }).then((r) => setFees(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  const generate = async () => {
    try { const { data } = await client.post("/admin/fees/generate"); toast.success(`${data.created} new fees generated for ${data.month}`); load(); }
    catch (err) { toast.error(formatError(err)); }
  };
  const exportLedger = () => {
    const csv = ["student,month,due_date,amount_pending,status", ...fees.map((f) => `"${f.student_name}",${f.month_year},${f.due_date},${f.monthly_fee_amount - f.paid_amount},${f.status}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "sanskritika-fee-ledger.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("Ledger downloaded");
  };
  return (
    <>
      <Header eyebrow="MONEY & CARE" title="Fees, made clear." description="Keep every family's monthly rhythm visible and gentle." action={<div className="head-actions"><button className="secondary-btn" onClick={generate} data-testid="fees-generate-button">Generate current month</button><button className="secondary-btn" onClick={exportLedger} data-testid="fees-export-button">Export ledger <ArrowUpRight size={16} /></button></div>} />
      <div className="fee-tabs">
        <button data-testid="fee-filter-all" className={!filter ? "active" : ""} onClick={() => setFilter("")}>All dues</button>
        {["OVERDUE", "DUE", "PARTIAL", "PAID"].map((x) => <button key={x} data-testid={`fee-filter-${x.toLowerCase()}`} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x[0] + x.slice(1).toLowerCase()}</button>)}
      </div>
      <section className="panel fee-table">
        <div className="table-head"><span>Student</span><span>Month</span><span>Due date</span><span>Amount</span><span>Status</span><span /></div>
        {fees.map((f) => <FeeRow f={f} key={f.id} onPay={() => setPay(f)} />)}
        {!fees.length && <div className="empty">No fee records for this filter.</div>}
      </section>
      {pay && <PaymentModal fee={pay} onClose={() => setPay(null)} onSaved={(r) => { setPay(null); setReceipt(r); load(); }} />}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

function FeeRow({ f, onPay }) {
  const pending = f.monthly_fee_amount - f.paid_amount;
  const waLink = `https://wa.me/${(f.guardian_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, ${f.student_name}'s ${f.month_year} music fee of ${money(pending)} is due on ${f.due_date}. — Sanskritika Mirza Academy`)}`;
  return (
    <div className="table-row" data-testid={`fee-row-${f.id}`}>
      <div className="row-student"><div className="tiny-avatar">{f.student_name[0]}</div><b>{f.student_name}</b></div>
      <span>{f.month_year}</span><span>{f.due_date}</span>
      <span><b>{money(pending)}</b><small> of {money(f.monthly_fee_amount)}</small></span>
      <span className={`badge ${f.status.toLowerCase()}`}>{f.status}</span>
      <div className="row-actions">
        {f.status !== "PAID" && <button className="collect-btn" onClick={onPay} data-testid={`collect-fee-${f.id}`}>Collect</button>}
        <a className="icon-btn" href={waLink} target="_blank" rel="noreferrer" data-testid={`reminder-link-${f.id}`}><MessageCircle size={16} /></a>
      </div>
    </div>
  );
}

function PaymentModal({ fee, onClose, onSaved }) {
  const pending = fee.monthly_fee_amount - fee.paid_amount;
  const [amount, setAmount] = useState(pending);
  const [mode, setMode] = useState("UPI");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await client.post("/admin/fees/pay", { fee_id: fee.id, amount: Number(amount), payment_mode: mode });
      toast.success("Payment recorded · receipt ready"); onSaved(data);
    } catch (err) { toast.error(formatError(err)); }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal small-modal">
        <button className="modal-close" onClick={onClose} data-testid="close-payment-modal"><X /></button>
        <div className="eyebrow">COLLECT FEE</div>
        <h2>Record a payment.</h2>
        <p className="muted">{money(pending)} pending for {fee.month_year}</p>
        <form onSubmit={submit}>
          <label>Amount received<input data-testid="payment-amount-input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
          <label>Payment mode<select data-testid="payment-mode-select" value={mode} onChange={(e) => setMode(e.target.value)}>{["UPI", "CASH", "CARD", "BANK_TRANSFER"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <button className="primary-btn full" type="submit" data-testid="payment-submit-button"><Receipt size={17} /> Save & generate receipt</button>
        </form>
      </div>
    </div>
  );
}

function ReceiptModal({ receipt, onClose }) {
  const print = () => window.print();
  const download = () => {
    const text = `Sanskritika Mirza Academy\nReceipt: ${receipt.receipt_number}\nStudent: ${receipt.student_name}\nMonth: ${receipt.month_year}\nAmount received: ${money(receipt.paid_amount)}\nPayment mode: ${receipt.payment_mode}`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = `${receipt.receipt_number}.txt`; a.click();
  };
  return (
    <div className="modal-backdrop">
      <div className="modal small-modal receipt-modal">
        <button className="modal-close" onClick={onClose} data-testid="close-receipt-modal"><X /></button>
        <div className="eyebrow">PAYMENT RECEIPT</div>
        <h2>Thank you for keeping the rhythm.</h2>
        <div className="receipt-paper">
          <b>SANSKRITIKA MIRZA</b>
          <span>Receipt {receipt.receipt_number}</span>
          <span>{receipt.student_name}</span>
          <strong>{money(receipt.paid_amount)}</strong>
          <small>{receipt.month_year} · {receipt.payment_mode}</small>
        </div>
        <div className="receipt-actions">
          <button className="primary-btn" onClick={print} data-testid="print-receipt-button"><Receipt size={16} /> Print</button>
          <button className="secondary-btn" onClick={download} data-testid="download-receipt-button">Download</button>
        </div>
      </div>
    </div>
  );
}
