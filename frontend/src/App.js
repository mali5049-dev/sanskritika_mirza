import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./api";
import "@/App.css";
import { Music2 } from "lucide-react";

import { PublicLanding, PublicApply, PublicTrack } from "./pages/Public";
import Login from "./pages/Login";
import AdminApp from "./pages/admin/AdminApp";
import TeacherApp from "./pages/teacher/TeacherApp";
import StudentApp from "./pages/student/StudentApp";

function Loading() {
  return (
    <div className="loading">
      <Music2 size={26} />
      <span>Opening the studio…</span>
    </div>
  );
}

function Home() {
  const { user, checking } = useAuth();
  if (checking) return <Loading />;
  if (user && user.role === "admin") return <Navigate to="/admin" replace />;
  if (user && user.role === "teacher") return <Navigate to="/teacher" replace />;
  if (user && user.role === "student") return <Navigate to="/student" replace />;
  return <PublicLanding />;
}

function Guard({ role, children }) {
  const { user, checking } = useAuth();
  if (checking) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/apply" element={<PublicApply />} />
          <Route path="/track" element={<PublicTrack />} />
          <Route path="/track/:trackingId" element={<PublicTrack />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/*" element={<Guard role="admin"><AdminApp /></Guard>} />
          <Route path="/teacher/*" element={<Guard role="teacher"><TeacherApp /></Guard>} />
          <Route path="/student/*" element={<Guard role="student"><StudentApp /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
