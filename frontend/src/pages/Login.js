import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowUpRight, Music2 } from "lucide-react";
import { client, formatError, useAuth } from "@/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const { data } = await client.post("/auth/login", { email, password });
      await refresh();
      if (data.role === "admin") navigate("/admin");
      else if (data.role === "teacher") navigate("/teacher");
      else navigate("/student");
    } catch (err) {
      setError(formatError(err) || "Please check your credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-art">
        <NavLink to="/" className="brand-mark" data-testid="login-home-link"><Music2 size={20} /> SM</NavLink>
        <div className="login-quote">
          <span>THE ACADEMY</span>
          <h1>Sign in<br /><i>to your studio.</i></h1>
          <p>Admins, teachers, and students share this door.</p>
        </div>
        <div className="sound-wave">♬　♩　♪　♫</div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <div className="eyebrow">SANSKRITIKA MIRZA · 2026</div>
          <h2>Welcome back.</h2>
          <p className="muted">Use the email your role was created with.</p>
          <form onSubmit={submit}>
            <label>Email address<input data-testid="login-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sanskritika.in" required /></label>
            <label>Password<input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required /></label>
            {error && <div className="error-text" data-testid="login-error">{error}</div>}
            <button className="primary-btn full" type="submit" disabled={busy} data-testid="login-submit-button">{busy ? "Signing in…" : "Enter studio"} <ArrowUpRight size={17} /></button>
          </form>
          <div className="login-links">
            <NavLink to="/apply" data-testid="login-apply-link">New here? Apply for admission</NavLink>
            <NavLink to="/track" data-testid="login-track-link">Track application status</NavLink>
          </div>
        </div>
      </section>
    </main>
  );
}
