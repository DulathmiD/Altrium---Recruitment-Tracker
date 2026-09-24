import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import MobileMenuButton from "../../components/MobileMenuButton";
import "./HRLayout.css";

const NAV_ITEMS = [
  { to: "/hr/vacancies", label: "Vacancies" },
  { to: "/hr/candidates", label: "Candidates" },
  { to: "/hr/interviews", label: "Interviews" },
  { to: "/hr/follow-ups", label: "Follow Ups" },
];

export default function HRLayout() {
  const { logout } = useAuth();
  // Mobile-only: whether the collapsible nav is expanded. Irrelevant on
  // desktop -- .layout-menu-btn and the "nav-open" class it controls only
  // do anything inside the max-width:768px block in index.css, so this
  // state has zero effect above that width.
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="hr-layout">
      <aside className={"hr-sidebar" + (navOpen ? " nav-open" : "")}>
        <div className="layout-topbar">
          <div className="hr-sidebar-title">
            <AltriumLogo size={28} />
            <span>Altrium</span>
          </div>
          <MobileMenuButton open={navOpen} onClick={() => setNavOpen((v) => !v)} />
        </div>
        {/* Grouped together (mobile-only) into one floating dropdown card
            anchored under the hamburger button -- see .layout-nav-panel --
            rather than nav and logout being two separate full-width
            desktop-style blocks stacked down the screen. */}
        <div className="layout-nav-panel">
          <nav className="hr-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "hr-nav-item" + (isActive ? " active" : "")}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="hr-logout" onClick={logout}>Log out</button>
        </div>
        <NotificationBell />
      </aside>
      {/* Dims the rest of the screen while the mobile menu is open; tapping
          it closes the menu, same as tapping a nav item does. */}
      <div className="layout-nav-backdrop" onClick={() => setNavOpen(false)} />
      <main className="hr-main">
        <Outlet />
      </main>
    </div>
  );
}
