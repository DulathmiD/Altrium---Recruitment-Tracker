import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleDashboard from "./pages/dashboards/RoleDashboard";
import HRLayout from "./pages/hr/HRLayout";
import VacanciesPage from "./pages/hr/VacanciesPage";

function ComingSoon({ label }: { label: string }) {
  return <div style={{ padding: 8 }}><h1 style={{ fontSize: 22, fontWeight: 600 }}>{label}</h1><p style={{ color: "#64748b" }}>Coming soon.</p></div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminLogin />} />

      <Route element={<ProtectedRoute allowedRoles={["HR"]} />}>
        <Route element={<HRLayout />}>
          <Route path="/hr/vacancies" element={<VacanciesPage />} />
          <Route path="/hr/candidates" element={<ComingSoon label="Candidates" />} />
          <Route path="/hr/interviews" element={<ComingSoon label="Interviews" />} />
          <Route path="/hr/follow-ups" element={<ComingSoon label="Follow Ups" />} />
          <Route path="/hr/dashboard" element={<Navigate to="/hr/vacancies" replace />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["HIRING_MANAGER"]} />}>
        <Route path="/hiring-manager/dashboard" element={<RoleDashboard label="Hiring Manager Dashboard" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["MANAGEMENT"]} />}>
        <Route path="/management/dashboard" element={<RoleDashboard label="Management Dashboard" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["LEADERSHIP_MANAGEMENT"]} />}>
        <Route path="/leadership-management/dashboard" element={<RoleDashboard label="Leadership Management Dashboard" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["INTERVIEWER"]} />}>
        <Route path="/interviewer/dashboard" element={<RoleDashboard label="Interviewer Dashboard" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["IT_ADMIN"]} />}>
        <Route path="/admin/dashboard" element={<RoleDashboard label="IT Admin Dashboard" />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
