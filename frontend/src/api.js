import axios from "axios";
import { createContext, useContext, useEffect, useState } from "react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const client = axios.create({ baseURL: API, withCredentials: true });

export function formatError(e) {
  const detail = e?.response?.data?.detail;
  if (!detail) return e?.message || "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (d && typeof d.msg === "string" ? d.msg : JSON.stringify(d))).filter(Boolean).join(" · ");
  if (typeof detail === "object" && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const SUNDAY_SLOTS = [
  "8:00 AM - 9:30 AM",
  "9:30 AM - 11:00 AM",
  "11:00 AM - 12:30 PM",
  "12:30 PM - 2:00 PM",
];

export const INSTRUMENTS = ["Piano Keyboard", "Guitar", "Violin", "Vocal", "Tabla", "Drums", "Others"];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = async () => {
    try {
      const r = await client.get("/auth/me");
      setUser(r.data);
      return r.data;
    } catch {
      setUser(false);
      return null;
    }
  };

  useEffect(() => {
    refresh().finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    try { await client.post("/auth/logout"); } catch {}
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, checking, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
