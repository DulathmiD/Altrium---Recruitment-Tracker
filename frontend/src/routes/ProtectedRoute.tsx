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
  return <Outlet />;
}
