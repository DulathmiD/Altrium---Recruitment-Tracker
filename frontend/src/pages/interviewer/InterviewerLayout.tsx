import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import "./InterviewerLayout.css";

const NAV_ITEMS = [
  { to: "/interviewer/interviews", label: "My Interviews" },
  { to: "/interviewer/candidates", label: "My Candidates" },
];

export default function InterviewerLayout() {
  const { logout } = useAuth();

  return (
    <div className="ivr-layout">
      <aside className="ivr-sidebar">
        <div className="ivr-sidebar-title">
          <AltriumLogo size={28} />
          <span>Altrium</span>
        </div>
        <nav className="ivr-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "ivr-nav-item" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NotificationBell />
        <button className="ivr-logout" onClick={logout}>Log out</button>
      </aside>
      <main className="ivr-main">
        <Outlet />
      </main>
    </div>
  );
}
