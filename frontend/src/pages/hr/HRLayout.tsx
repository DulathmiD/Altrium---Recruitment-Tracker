import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import "./HRLayout.css";

const NAV_ITEMS = [
  { to: "/hr/vacancies", label: "Vacancies" },
  { to: "/hr/candidates", label: "Candidates" },
  { to: "/hr/interviews", label: "Interviews" },
  { to: "/hr/follow-ups", label: "Follow Ups" },
];

export default function HRLayout() {
  const { logout } = useAuth();

  return (
    <div className="hr-layout">
      <aside className="hr-sidebar">
        <div className="hr-sidebar-title">
          <AltriumLogo size={28} />
          <span>Altrium</span>
        </div>
        <nav className="hr-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "hr-nav-item" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NotificationBell />
        <button className="hr-logout" onClick={logout}>Log out</button>
      </aside>
      <main className="hr-main">
        <Outlet />
      </main>
    </div>
  );
}
