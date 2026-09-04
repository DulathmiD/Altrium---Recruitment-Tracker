import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import "./ITAdminLayout.css";

const NAV_ITEMS = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/audit-logs", label: "Audit Logs" },
  { to: "/admin/system", label: "System" },
  { to: "/admin/notification-templates", label: "Notification Templates" },
];

export default function ITAdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">
          <AltriumLogo size={28} />
          <span>Altrium IT</span>
        </div>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "admin-nav-item" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NotificationBell />
        <button className="admin-logout" onClick={logout}>Log out</button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
