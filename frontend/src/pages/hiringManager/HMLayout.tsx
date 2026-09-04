import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AltriumLogo from "../../components/AltriumLogo";
import NotificationBell from "../../components/NotificationBell";
import "./HMLayout.css";

// Corrections doc: "the hiring manager doesn't have an interview page" --
// the HM isn't an interviewer/panelist; their role is deciding
// Proceed/Do Not Proceed/Hire/Reject from Pending Decisions based on
// others' feedback, not sitting on interview panels themselves. My
// Interviews removed accordingly (see App.tsx for the matching route
// removal, and seed-full-demo.ts -- hm.id no longer seeded as a panelist).
const NAV_ITEMS = [
  { to: "/hiring-manager/dashboard", label: "Dashboard" },
  { to: "/hiring-manager/vacancies", label: "Vacancies" },
  { to: "/hiring-manager/candidate-comparison", label: "Candidate Comparison" },
  { to: "/hiring-manager/pending-decisions", label: "Pending Decisions" },
  { to: "/hiring-manager/decision-history", label: "Decision History" },
];

export default function HMLayout() {
  const { logout } = useAuth();

  return (
    <div className="hm-layout">
      <aside className="hm-sidebar">
        <div className="hm-sidebar-title">
          <AltriumLogo size={28} />
          <span>Altrium</span>
        </div>
        <nav className="hm-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "hm-nav-item" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NotificationBell />
        <button className="hm-logout" onClick={logout}>Log out</button>
      </aside>
      <main className="hm-main">
        <Outlet />
      </main>
    </div>
  );
}
