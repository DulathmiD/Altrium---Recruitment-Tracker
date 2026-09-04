import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import "./LeadershipLayout.css";

const NAV_ITEMS = [
  { to: "/leadership-management/recruitment-overview", label: "Recruitment Overview" },
  { to: "/leadership-management/department-performance", label: "Department Performance" },
  { to: "/leadership-management/hiring-trends", label: "Hiring Trends" },
  { to: "/leadership-management/reports", label: "Export Reports" },
];

export default function LeadershipLayout() {
  const { logout } = useAuth();

  return (
    <div className="ld-layout">
      <aside className="ld-sidebar">
        <div className="ld-sidebar-title">
          <AltriumLogo size={28} />
          <span>Altrium</span>
        </div>
        <nav className="ld-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "ld-nav-item" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NotificationBell />
        <button className="ld-logout" onClick={logout}>Log out</button>
      </aside>
      <main className="ld-main">
        <Outlet />
      </main>
    </div>
  );
}
