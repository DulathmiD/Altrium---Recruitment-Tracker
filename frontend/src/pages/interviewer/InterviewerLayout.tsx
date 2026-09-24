import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import MobileMenuButton from "../../components/MobileMenuButton";
import "./InterviewerLayout.css";

const NAV_ITEMS = [
  { to: "/interviewer/interviews", label: "My Interviews" },
  { to: "/interviewer/candidates", label: "My Candidates" },
];

export default function InterviewerLayout() {
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="ivr-layout">
      <aside className={"ivr-sidebar" + (navOpen ? " nav-open" : "")}>
        <div className="layout-topbar">
          <div className="ivr-sidebar-title">
            <AltriumLogo size={28} />
            <span>Altrium</span>
          </div>
          <MobileMenuButton open={navOpen} onClick={() => setNavOpen((v) => !v)} />
        </div>
        <div className="layout-nav-panel">
          <nav className="ivr-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "ivr-nav-item" + (isActive ? " active" : "")}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="ivr-logout" onClick={logout}>Log out</button>
        </div>
        <NotificationBell />
      </aside>
      <div className="layout-nav-backdrop" onClick={() => setNavOpen(false)} />
      <main className="ivr-main">
        <Outlet />
      </main>
    </div>
  );
}
