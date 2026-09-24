import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import MobileMenuButton from "../../components/MobileMenuButton";
import "./LeadershipLayout.css";

const NAV_ITEMS = [
  { to: "/leadership-management/recruitment-overview", label: "Recruitment Overview" },
  { to: "/leadership-management/department-performance", label: "Department Performance" },
  { to: "/leadership-management/hiring-trends", label: "Hiring Trends" },
  { to: "/leadership-management/reports", label: "Export Reports" },
];

export default function LeadershipLayout() {
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="ld-layout">
      <aside className={"ld-sidebar" + (navOpen ? " nav-open" : "")}>
        <div className="layout-topbar">
          <div className="ld-sidebar-title">
            <AltriumLogo size={28} />
            <span>Altrium</span>
          </div>
          <MobileMenuButton open={navOpen} onClick={() => setNavOpen((v) => !v)} />
        </div>
        <div className="layout-nav-panel">
          <nav className="ld-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "ld-nav-item" + (isActive ? " active" : "")}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="ld-logout" onClick={logout}>Log out</button>
        </div>
        <NotificationBell />
      </aside>
      <main className="ld-main">
        <Outlet />
      </main>
    </div>
  );
}
