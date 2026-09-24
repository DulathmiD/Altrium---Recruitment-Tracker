import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import MobileMenuButton from "../../components/MobileMenuButton";
import "./MgmtLayout.css";

// Corrections doc: "My Candidates" and "Candidate Progress" used to be two
// separate nav items -- combined onto one page/route (see
// CandidateProgressPage.tsx), so there's one nav entry for both now.
const NAV_ITEMS = [
  { to: "/management/dashboard", label: "Dashboard" },
  { to: "/management/vacancies", label: "Department Vacancies" },
  { to: "/management/candidate-progress", label: "Candidates" },
  { to: "/management/my-interviews", label: "My Interviews" },
  { to: "/management/reports", label: "Reports" },
];

export default function MgmtLayout() {
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="mg-layout">
      <aside className={"mg-sidebar" + (navOpen ? " nav-open" : "")}>
        <div className="layout-topbar">
          <div className="mg-sidebar-title">
            <AltriumLogo size={28} />
            <span>Altrium</span>
          </div>
          <MobileMenuButton open={navOpen} onClick={() => setNavOpen((v) => !v)} />
        </div>
        <div className="layout-nav-panel">
          <nav className="mg-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "mg-nav-item" + (isActive ? " active" : "")}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="mg-logout" onClick={logout}>Log out</button>
        </div>
        <NotificationBell />
      </aside>
      <div className="layout-nav-backdrop" onClick={() => setNavOpen(false)} />
      <main className="mg-main">
        <Outlet />
      </main>
    </div>
  );
}
