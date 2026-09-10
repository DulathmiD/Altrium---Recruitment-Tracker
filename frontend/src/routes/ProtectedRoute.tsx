import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles: string[] }) {
  const { token, user } = useAuth();
  const isAdminRoute = allowedRoles.includes("IT_ADMIN");

  if (!token || !user) {
    return <Navigate to={isAdminRoute ? "/admin" : "/login"} replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={isAdminRoute ? "/admin" : "/login"} replace />;
  }
  // IT-Admin-created accounts start with a shared, IT-Admin-chosen initial
  // password and no forced-reset step existed before this -- this blocks
  // every role-gated screen until the account's own password change clears
  // the flag, so someone can't just close the change-password tab and keep
  // using the initial password indefinitely.
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}
