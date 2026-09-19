import { useEffect, useMemo, useState } from "react";
import { getMyDashboard, getMyVacancies, type HmDashboard, type HmVacancy } from "../../api/hiringManager";
import "./DashboardPage.css";

type DateRangeFilter = "ALL" | "30" | "90";

// Visual redesign pass, per direct user feedback ("recreate the dashboards
// ... make it nice and legite and corporate like and proffesional"): same
// data/instructions as before, just restyled. Accent colors are pulled
// straight from the status-pill palette already used across the rest of the
// app (CandidatesPage.css's .cnd-status-* colors) rather than inventing new
// ones -- Shortlisted's green, Hired's amber, Rejected's red, and the same
// blue used for "in progress"/informational badges. Interview rounds all
// share one neutral blue rather than a color per round, since rounds are
// per-vacancy-configurable text, not a fixed small set like the anchors.
type ProgressRow = { key: string; label: string; count: number; accent: "green" | "gold" | "red" | "blue" };

export default function DashboardPage() {
  const [data, setData] = useState<HmDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters mirror VacanciesPage.tsx: a single HM's assigned vacancies can
  // span multiple departments (see seed-hiring-manager-screens.ts), so Date
  // Range / Department / Vacancy filters are useful here too -- unlike
  // Management, which is locked to one department and skips a Department
  // filter entirely (see management.controller.ts's comment on that).
  const [dateRange, setDateRange] = useState<DateRangeFilter>("ALL");
  const [department, setDepartment] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [applied, setApplied] = useState({ dateRange, department, vacancyFilter });

  const [vacancyOptions, setVacancyOptions] = useState<HmVacancy[]>([]);
  useEffect(() => {
    getMyVacancies().then(setVacancyOptions).catch(() => {});
  }, []);

  const departments = useMemo(() => [...new Set(vacancyOptions.map((v) => v.department))].sort(), [vacancyOptions]);

  useEffect(() => {
    setLoading(true);
    getMyDashboard({
      dateRange: applied.dateRange === "ALL" ? undefined : applied.dateRange,
      vacancyId: applied.vacancyFilter ? Number(applied.vacancyFilter) : undefined,
      department: applied.department || undefined,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard"))
      .finally(() => setLoading(false));
  }, [applied]);

  // Anchors + rounds combined into one comparable list so Recruitment
  // Progress can render as proportional bars (relative to whichever stage
  // has the most candidates) instead of a grid of same-size boxes -- makes
  // the actual shape of the pipeline visible at a glance rather than making
  // HR read every number individually.
  const progressRows: ProgressRow[] = useMemo(() => {
    if (!data) return [];
    const anchorRows: ProgressRow[] = data.anchors
      .filter((a) => a.stage !== "APPLIED")
      .map((a) => ({
        key: `anchor-${a.stage}`,
        label: a.label,
        count: a.candidateCount,
        accent: a.stage === "HIRED" ? "gold" : a.stage === "REJECTED" ? "red" : "green",
      }));
    const roundRows: ProgressRow[] = data.rounds.map((r) => ({
      key: `round-${r.order}`,
      label: r.label,
      count: r.candidateCount,
      accent: "blue",
    }));
    return [...roundRows, ...anchorRows];
  }, [data]);
  const maxProgressCount = Math.max(1, ...progressRows.map((r) => r.count));

  return (
    <div className="hmd-page">
      {/* Per direct user feedback: "Hiring Manager Dashboard" read as too
          literal a restating of the role -- the sidebar's own "Dashboard"
          nav item already says as much. Renamed to describe the content
          instead of the audience, matching Management's "Department
          Recruitment" and Leadership's "Recruitment Overview" (neither of
          which names the role either). Title styling and the divider below
          it now match VacanciesPage's "Vacancies" heading exactly, per
          direct user request, and the descriptive subtitle was dropped. */}
      <h1 className="hmd-title">Hiring Overview</h1>
      <div className="hmd-divider" />

      {loading && <p className="hmd-muted">Loading...</p>}
      {error && <p className="hmd-error">{error}</p>}

      {data && (
        <>
          {vacancyOptions.length > 0 && (
            <div className="hmd-filter-bar">
              <div className="hmd-filter-fields">
                <div className="hmd-filter-field">
                  <label>Date Range</label>
                  <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
                    <option value="ALL">All time</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                </div>
                <div className="hmd-filter-field">
                  <label>Department</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">All departments</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="hmd-filter-field">
                  <label>Vacancy</label>
                  <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
                    <option value="">All vacancies</option>
                    {vacancyOptions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
              </div>
              <button
                className="hmd-apply-btn"
                onClick={() => setApplied({ dateRange, department, vacancyFilter })}
              >
                Apply
              </button>
            </div>
          )}

          <div className="hmd-kpi-grid">
            <div className="hmd-kpi-tile hmd-kpi-tile--blue">
              <div className="hmd-kpi-label">Open Vacancies</div>
              <div className="hmd-kpi-value">{data.openVacancies}</div>
            </div>
            <div className="hmd-kpi-tile hmd-kpi-tile--gold">
              <div className="hmd-kpi-label">Awaiting My Decision</div>
              <div className="hmd-kpi-value">{data.awaitingMyDecision}</div>
            </div>
            <div className="hmd-kpi-tile hmd-kpi-tile--green">
              <div className="hmd-kpi-label">Hired</div>
              <div className="hmd-kpi-value">{data.hired}</div>
            </div>
            <div className="hmd-kpi-tile hmd-kpi-tile--red">
              <div className="hmd-kpi-label">Rejected</div>
              <div className="hmd-kpi-value">{data.rejected}</div>
            </div>
          </div>

          <div className="hmd-panel">
            <h2 className="hmd-section-title">Recruitment Progress</h2>
            <p className="hmd-muted">Across every vacancy you're involved in.</p>
            <div className="hmd-progress-list">
              {progressRows.map((r) => (
                <div key={r.key} className="hmd-progress-row">
                  <span className="hmd-progress-row-label">{r.label}</span>
                  <div className="hmd-progress-row-track">
                    <div
                      className={`hmd-progress-row-fill hmd-progress-row-fill--${r.accent}`}
                      style={{ width: `${Math.max(4, (r.count / maxProgressCount) * 100)}%` }}
                    />
                  </div>
                  <span className="hmd-progress-row-value">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
