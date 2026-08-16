import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Check, ChevronRight, ClipboardCheck, LogOut, Menu, Music2, Sparkles, UsersRound, X } from "lucide-react";
import { client, formatError, useAuth } from "@/api";

export default function TeacherApp() {
  const { user, logout } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [data, setData] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);

  useEffect(() => { client.get("/teacher/batches").then((r) => setData(r.data)); }, []);

  if (!data) return <div className="loading"><Music2 size={22} /><span>Loading your studios…</span></div>;

  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="logo" data-testid="teacher-logo">
          <div className="logo-icon"><Music2 size={20} /></div>
          <div><strong>Sanskritika<br />Mirza</strong><span>TEACHER STUDIO</span></div>
        </div>
        <nav>
          <a className="active"><UsersRound size={18} /> My batches</a>
        </nav>
        <div className="sidebar-footer">
          <div className="mini-note"><Sparkles size={15} /><span>"A great teacher<br />is a gentle drum."</span></div>
          <button className="logout" onClick={logout} data-testid="teacher-logout-button"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobile(!mobile)} data-testid="teacher-mobile-menu"><Menu size={20} /></button>
          <div className="breadcrumb">Studio <ChevronRight size={14} /> <b>{activeBatch ? activeBatch.name : "My batches"}</b></div>
          <div className="profile"><div className="avatar">{user?.name?.[0] || "T"}</div><div><b>{user?.name}</b><span>Teacher</span></div></div>
        </header>
        <div className="content">
          {!activeBatch ? (
            <>
              <div className="page-head">
                <div>
                  <div className="eyebrow">TEACHER PORTAL</div>
                  <h1>Good day, <i>{user?.name?.split(" ")[0]}.</i></h1>
                  <p className="muted">{data.batches.length} batches assigned across {data.teacher.specialization.join(" · ")}.</p>
                </div>
              </div>
              <div className="student-grid">
                {data.batches.map((b) => (
                  <button className="student-card" key={b.id} onClick={() => setActiveBatch(b)} data-testid={`teacher-batch-${b.id}`}>
                    <div className="student-avatar">{b.instrument[0]}</div>
                    <div className="student-info">
                      <div className="status-dot">● {b.enrolled_count} students</div>
                      <h3>{b.name}</h3>
                      <span>{b.instrument}</span>
                      <small>{b.day_of_week} · {b.slot}</small>
                    </div>
                    <ArrowUpRight className="card-arrow" size={17} />
                  </button>
                ))}
                {!data.batches.length && <div className="empty">No batches assigned yet. Please check with the admin.</div>}
              </div>
            </>
          ) : (
            <TeacherBatch batch={activeBatch} onBack={() => setActiveBatch(null)} />
          )}
        </div>
      </main>
    </div>
  );
}

function TeacherBatch({ batch, onBack }) {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const load = () => client.get("/teacher/attendance", { params: { batch_id: batch.id, day } }).then((r) => setRows(r.data.rows));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [day, batch.id]);

  const mark = async (row, status) => {
    try {
      await client.post("/teacher/attendance", { student_id: row.student.id, batch_id: batch.id, date: day, status, remarks: "" });
      setRows((prev) => prev.map((x) => (x.student.id === row.student.id ? { ...x, record: { ...x.record, status } } : x)));
      toast.success("Attendance saved");
    } catch (err) { toast.error(formatError(err)); }
  };

  const present = rows.filter((x) => x.record.status === "PRESENT").length;

  return (
    <>
      <button className="back-link" onClick={onBack} data-testid="teacher-back-link">← All my batches</button>
      <div className="page-head">
        <div>
          <div className="eyebrow">{batch.day_of_week.toUpperCase()} · {batch.slot.toUpperCase()}</div>
          <h1>{batch.name}</h1>
          <p className="muted">{batch.enrolled_count} learners in {batch.instrument}</p>
        </div>
        <button className="primary-btn" onClick={() => Promise.all(rows.map((r) => mark(r, "PRESENT")))} data-testid="teacher-mark-all-present"><Check size={17} /> Mark all present</button>
      </div>
      <div className="attendance-controls">
        <label>Date<input data-testid="teacher-attendance-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <div className="attendance-summary"><b>{present} <span>present</span></b><b>{rows.length - present} <span>to mark</span></b></div>
      </div>
      <section className="panel register">
        <div className="register-head"><span>Learner</span><span>Roll number</span><span>Mark status</span></div>
        {rows.map((r) => (
          <div className="register-row" key={r.student.id}>
            <div className="row-student"><div className="tiny-avatar">{r.student.student_name[0]}</div><b>{r.student.student_name}</b></div>
            <span>{r.student.roll_number || "—"}</span>
            <div className="attendance-actions">
              <button data-testid={`teacher-present-${r.student.id}`} className={r.record.status === "PRESENT" ? "selected present" : ""} onClick={() => mark(r, "PRESENT")}><Check size={15} /> Present</button>
              <button data-testid={`teacher-absent-${r.student.id}`} className={r.record.status === "ABSENT" ? "selected absent" : ""} onClick={() => mark(r, "ABSENT")}><X size={15} /> Absent</button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="empty">No students in this batch yet.</div>}
      </section>
    </>
  );
}
