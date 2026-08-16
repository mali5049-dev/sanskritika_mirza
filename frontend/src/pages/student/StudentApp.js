import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ClipboardCheck, LogOut, Menu, Music2, Sparkles, WalletCards, X } from "lucide-react";
import { client, formatError, money, useAuth } from "@/api";

export default function StudentApp() {
  const { user, logout } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [data, setData] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    client.get("/student/me").then((r) => setData(r.data)).catch((e) => toast.error(formatError(e)));
    if (user?.must_change_password) setShowChangePw(true);
  }, [user]);

  if (!data) return <div className="loading"><Music2 size={22} /><span>Opening your journal…</span></div>;

  const s = data.student;
  const currentFee = data.fees[0];
  const totalPending = data.fees.reduce((n, f) => n + (f.monthly_fee_amount - f.paid_amount), 0);
  const presentCount = data.attendance.filter((a) => a.status === "PRESENT").length;

  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="logo" data-testid="student-logo">
          <div className="logo-icon"><Music2 size={20} /></div>
          <div><strong>Sanskritika<br />Mirza</strong><span>STUDENT JOURNAL</span></div>
        </div>
        <nav>
          <a className="active"><Music2 size={18} /> My journey</a>
        </nav>
        <div className="sidebar-footer">
          <div className="mini-note"><Sparkles size={15} /><span>"Practice sings<br />louder than talent."</span></div>
          <button className="logout" onClick={logout} data-testid="student-logout-button"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobile(!mobile)} data-testid="student-mobile-menu"><Menu size={20} /></button>
          <div className="breadcrumb">Journal <ChevronRight size={14} /> <b>{s.student_name}</b></div>
          <div className="profile"><div className="avatar">{s.student_name[0]}</div><div><b>{s.student_name}</b><span>Student · {s.roll_number}</span></div></div>
        </header>
        <div className="content">
          <div className="page-head">
            <div>
              <div className="eyebrow">STUDENT DASHBOARD</div>
              <h1>Welcome back, <i>{s.student_name.split(" ")[0]}.</i></h1>
              <p className="muted">{(s.subjects || []).join(" · ")} · {s.sunday_batch_slot}</p>
            </div>
            <button className="secondary-btn" onClick={() => setShowChangePw(true)} data-testid="student-change-password">Change password</button>
          </div>
          <div className="stats-grid">
            <Stat label="Roll number" value={s.roll_number} detail={s.enrollment_type} tone="ochre" />
            <Stat label="Attendance so far" value={`${presentCount}/${data.attendance.length}`} detail="Sessions logged" tone="sage" />
            <Stat label="Fees pending" value={money(totalPending)} detail={currentFee ? `Next due ${currentFee.due_date}` : "All caught up"} tone="rose" />
            <Stat label="Monthly fee" value={money(s.monthly_fee)} detail="Standard tuition" tone="blue" />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head"><div><div className="eyebrow">MY TEACHER</div><h3>{data.teacher?.name || "Teacher yet to be assigned"}</h3></div></div>
              <Info label="Batch" value={data.batch ? `${data.batch.name} · ${data.batch.slot}` : "Unassigned"} />
              <Info label="Specialization" value={(data.teacher?.specialization || []).join(" · ") || "—"} />
              <Info label="Contact" value={data.teacher?.email || "—"} />
              <Info label="Guardian on file" value={`${s.father_guardian_name || "—"} · ${s.father_guardian_phone}`} />
              <Info label="Learning aim" value={s.aim_of_learning || "Not added"} />
            </section>
            <section className="panel">
              <div className="panel-head"><div><div className="eyebrow">MY LEDGER</div><h3>Fees</h3></div><span className="pill sage-pill"><WalletCards size={12} /> {money(totalPending)} due</span></div>
              {data.fees.length === 0 && <div className="empty">No fee records yet.</div>}
              {data.fees.map((f) => (
                <div className="history-row" key={f.id} data-testid={`student-fee-${f.id}`}>
                  <span>{f.month_year}</span>
                  <span>{money(f.paid_amount)} / {money(f.monthly_fee_amount)}</span>
                  <b className={f.status.toLowerCase()}>{f.status}</b>
                </div>
              ))}
              <div className="panel-head fee-head"><div><div className="eyebrow">ATTENDANCE</div><h3>Recent sessions</h3></div><span className="pill sage-pill"><ClipboardCheck size={12} /> {presentCount} present</span></div>
              {data.attendance.length === 0 && <div className="empty">No sessions recorded yet.</div>}
              {data.attendance.slice(0, 8).map((a) => (
                <div className="history-row" key={a.id || a.date} data-testid={`student-attendance-${a.date}`}>
                  <span>{a.date}</span>
                  <span>{a.remarks || "—"}</span>
                  <b className={a.status.toLowerCase()}>{a.status}</b>
                </div>
              ))}
            </section>
          </div>
        </div>
      </main>
      {showChangePw && <ChangePasswordModal forced={user?.must_change_password} onClose={() => setShowChangePw(false)} />}
    </div>
  );
}

function Stat({ label, value, detail, tone }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-top"><span>{label}</span></div>
      <strong>{value}</strong><small>{detail}</small>
    </div>
  );
}

function Info({ label, value }) { return <div className="info"><span>{label}</span><b>{value}</b></div>; }

function ChangePasswordModal({ onClose, forced }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("New password must be at least 6 characters");
    setBusy(true);
    try {
      await client.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password updated");
      await refresh();
      onClose();
    } catch (err) { toast.error(formatError(err)); } finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal small-modal">
        {!forced && <button className="modal-close" onClick={onClose} data-testid="close-change-password"><X /></button>}
        <div className="eyebrow">SECURE YOUR ACCOUNT</div>
        <h2>{forced ? "Set a new password" : "Change password"}</h2>
        <p className="muted">{forced ? "This is your first sign-in. Please set a personal password." : "Update your password securely."}</p>
        <form onSubmit={submit}>
          <label>Current password<input data-testid="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
          <label>New password<input data-testid="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
          <button className="primary-btn full" type="submit" disabled={busy} data-testid="submit-change-password">{busy ? "Saving…" : "Update password"}</button>
        </form>
      </div>
    </div>
  );
}
