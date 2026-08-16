import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, Music2, Search, Sparkles, CheckCircle2, XCircle, Clock3, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { client, formatError, SUNDAY_SLOTS, INSTRUMENTS } from "@/api";

function PublicNav() {
  return (
    <header className="public-nav">
      <NavLink to="/" className="brand-mark" data-testid="public-home-link">
        <Music2 size={20} /> SANSKRITIKA MIRZA
      </NavLink>
      <nav>
        <NavLink to="/apply" data-testid="public-nav-apply">Apply</NavLink>
        <NavLink to="/track" data-testid="public-nav-track">Track status</NavLink>
        <NavLink to="/login" className="cta-link" data-testid="public-nav-login">Sign in <ArrowUpRight size={14} /></NavLink>
      </nav>
    </header>
  );
}

export function PublicLanding() {
  return (
    <div className="public-shell">
      <PublicNav />
      <main className="hero">
        <section className="hero-copy">
          <span className="eyebrow">ACADEMY OF INDIAN · WESTERN · CONTEMPORARY MUSIC</span>
          <h1>Where discipline<br /><i>becomes music.</i></h1>
          <p>Guided by Sanskritika Mirza, our academy shapes patient, joyful musicians across piano, guitar, vocal, violin, tabla, and drums. Apply today or track an existing admission.</p>
          <div className="hero-actions">
            <NavLink to="/apply" className="primary-btn" data-testid="hero-apply-button"><Sparkles size={17} /> Apply for admission</NavLink>
            <NavLink to="/track" className="secondary-btn" data-testid="hero-track-button">Track my application <ArrowUpRight size={15} /></NavLink>
          </div>
          <div className="hero-tiles">
            <div><b>6</b><span>Disciplines</span></div>
            <div><b>4</b><span>Sunday batches</span></div>
            <div><b>1:6</b><span>Teacher ratio</span></div>
          </div>
        </section>
        <aside className="hero-visual">
          <div className="hero-card">
            <span className="eyebrow">FROM THE STUDIO</span>
            <h3>“Music is the language of the soul.”</h3>
            <p>— Sanskritika Mirza, Founder</p>
          </div>
          <div className="hero-notes">♬　♩　♪　♫　♭　♯</div>
        </aside>
      </main>
      <footer className="public-footer">
        <span>© {new Date().getFullYear()} Sanskritika Mirza · Academy of Music</span>
        <span>Delhi · India</span>
      </footer>
    </div>
  );
}

export function PublicApply() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    student_name: "", dob: "", gender: "OTHER", father_guardian_name: "", father_guardian_phone: "",
    mother_name: "", mother_phone: "", email: "", address: "", school_college_name: "",
    educational_qualification: "", grade_class: "", prior_music_knowledge: "",
    subjects: ["Piano Keyboard"], preferred_sunday_slot: SUNDAY_SLOTS[1], weekday_slot: "", aim_of_learning: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const update = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.student_name || !form.father_guardian_phone) {
      setError("Student name and guardian phone are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await client.post("/applications", form);
      setResult(data);
      toast.success("Application submitted");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="public-shell">
        <PublicNav />
        <main className="apply-success" data-testid="apply-success-panel">
          <div className="success-card">
            <CheckCircle2 size={42} className="success-icon" />
            <span className="eyebrow">APPLICATION RECEIVED</span>
            <h2>Thank you, <i>{result.student_name}</i>.</h2>
            <p>Please share this tracking ID with the academy at your visit. Our team will verify your details and share the next steps.</p>
            <div className="tracking-box" data-testid="tracking-id-display">{result.tracking_id}</div>
            <div className="success-actions">
              <button className="primary-btn" onClick={() => navigate(`/track/${result.tracking_id}`)} data-testid="apply-view-status-button">View status <ArrowUpRight size={15} /></button>
              <NavLink to="/" className="secondary-btn" data-testid="apply-home-link">Back to home</NavLink>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="public-shell">
      <PublicNav />
      <main className="apply-shell">
        <div className="apply-head">
          <span className="eyebrow">STEP INTO THE STUDIO</span>
          <h1>New admission form.</h1>
          <p>Fill this in a few minutes. Fees are collected at the academy after our team reviews your details.</p>
        </div>
        <form className="apply-form" onSubmit={submit}>
          <label>Student full name*<input data-testid="apply-name" value={form.student_name} onChange={(e) => update("student_name", e.target.value)} placeholder="e.g. Aarav Mehta" /></label>
          <label>Guardian phone*<input data-testid="apply-guardian-phone" value={form.father_guardian_phone} onChange={(e) => update("father_guardian_phone", e.target.value)} placeholder="10-digit number" /></label>
          <label>Date of birth<input data-testid="apply-dob" type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} /></label>
          <label>Gender<select data-testid="apply-gender" value={form.gender} onChange={(e) => update("gender", e.target.value)}>{["MALE", "FEMALE", "OTHER"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Guardian name<input data-testid="apply-guardian-name" value={form.father_guardian_name} onChange={(e) => update("father_guardian_name", e.target.value)} /></label>
          <label>Mother's name<input data-testid="apply-mother-name" value={form.mother_name} onChange={(e) => update("mother_name", e.target.value)} /></label>
          <label>Email<input data-testid="apply-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="For account creation on approval" /></label>
          <label>School / college<input data-testid="apply-school" value={form.school_college_name} onChange={(e) => update("school_college_name", e.target.value)} /></label>
          <label>Grade / class<input data-testid="apply-grade" value={form.grade_class} onChange={(e) => update("grade_class", e.target.value)} /></label>
          <label>Primary instrument<select data-testid="apply-subject" value={form.subjects[0]} onChange={(e) => update("subjects", [e.target.value])}>{INSTRUMENTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Preferred Sunday batch<select data-testid="apply-slot" value={form.preferred_sunday_slot} onChange={(e) => update("preferred_sunday_slot", e.target.value)}>{SUNDAY_SLOTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Prior music experience<input data-testid="apply-prior" value={form.prior_music_knowledge} onChange={(e) => update("prior_music_knowledge", e.target.value)} placeholder="Beginner / self-taught / grade 2 etc." /></label>
          <label className="wide">Address<textarea data-testid="apply-address" value={form.address} onChange={(e) => update("address", e.target.value)} /></label>
          <label className="wide">Aim of learning<textarea data-testid="apply-aim" value={form.aim_of_learning} onChange={(e) => update("aim_of_learning", e.target.value)} placeholder="Why do you want to learn music at the academy?" /></label>
          {error && <div className="error-text wide" data-testid="apply-error">{error}</div>}
          <button className="primary-btn wide" type="submit" disabled={submitting} data-testid="apply-submit-button">{submitting ? "Submitting…" : "Submit application"} <ArrowUpRight size={16} /></button>
        </form>
      </main>
    </div>
  );
}

const STATUS_ICON = { PENDING: <Clock3 size={22} />, APPROVED: <CheckCircle2 size={22} />, REJECTED: <XCircle size={22} /> };

export function PublicTrack() {
  const { trackingId: paramId } = useParams();
  const [tid, setTid] = useState(paramId || "");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const look = async (id) => {
    if (!id) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await client.get(`/applications/track/${encodeURIComponent(id.trim().toUpperCase())}`);
      setResult(data);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (paramId) look(paramId); /* eslint-disable-next-line */ }, [paramId]);

  return (
    <div className="public-shell">
      <PublicNav />
      <main className="track-shell">
        <div className="apply-head">
          <span className="eyebrow">APPLICATION STATUS</span>
          <h1>Where does my<br /><i>application stand?</i></h1>
          <p>Use the tracking ID sent to you at submission. If lost, please contact the academy office.</p>
        </div>
        <form className="track-form" onSubmit={(e) => { e.preventDefault(); look(tid); }}>
          <div className="search big">
            <Search size={17} />
            <input data-testid="track-input" placeholder="Paste your tracking ID · e.g. SM-APP-2026-200" value={tid} onChange={(e) => setTid(e.target.value)} />
          </div>
          <button className="primary-btn" type="submit" disabled={loading} data-testid="track-submit-button">{loading ? "Looking…" : "Check status"} <ArrowUpRight size={15} /></button>
        </form>
        {error && <div className="error-text" data-testid="track-error">{error}</div>}
        {result && (
          <section className={`status-panel status-${result.status.toLowerCase()}`} data-testid="track-result">
            <div className="status-badge">{STATUS_ICON[result.status] || <Clock3 />}<span>{result.status}</span></div>
            <h2>{result.student_name}</h2>
            <div className="status-meta">
              <div><span>Tracking ID</span><b>{result.tracking_id}</b></div>
              <div><span>Applied for</span><b>{(result.subjects || []).join(" · ") || "—"}</b></div>
              <div><span>Preferred slot</span><b>{result.preferred_sunday_slot || "—"}</b></div>
              <div><span>Submitted</span><b>{new Date(result.created_at).toLocaleDateString()}</b></div>
            </div>
            {result.status === "APPROVED" && <p className="status-message"><ChevronRight size={16} /> Congratulations — please sign in with the credentials given by the academy at your visit.</p>}
            {result.status === "REJECTED" && <p className="status-message rejection">{result.rejection_reason || "Please contact the academy for details."}</p>}
            {result.status === "PENDING" && <p className="status-message">Our team is reviewing your form. We'll be in touch shortly for the offline visit and payment.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
