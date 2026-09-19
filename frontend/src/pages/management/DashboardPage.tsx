import { useEffect, useMemo, useState } from "react";
import { getManagementDashboard, getDepartmentVacancies, type ManagementDashboard, type ManagementVacancy } from "../../api/management";
import "./DashboardPage.css";

type DateRangeFilter = "" | "30" | "90";

// Visual redesign pass, per direct user feedback ("recreate the dashboards
// ... make it nice and legite and corporate like and proffesional"): same
// data/instructions as before, just restyled -- same pattern as the Hiring
// Manager and Leadership dashboards, for a consistent look across every
// role. Accent colors are pulled straight from the status-pill palette
// already used across the app (CandidatesPage.css's .cnd-status-* colors),
// not invented new.
type ProgressRow = { key: string; label: string; count: number; accent: "green" | "gold" | "red" | "blue" };

export default function DashboardPage() {
  const [data, setData] = useState<ManagementDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateRange, setDateRange] = useState<DateRangeFilter>("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [applied, setApplied] = useState({ dateRange, vacancyFilter });

  const [vacancyOptions, setVacancyOptions] = useState<ManagementVacancy[]>([]);
  useEffect(() => {
    getDepartmentVacancies().then((res) => {
      if (res.hasDepartment) setVacancyOptions(res.vacancies);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getManagementDashboard({ dateRange: applied.dateRange || undefined, vacancyId: applied.vacancyFilter ? Number(applied.vacancyFilter) : undefined })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard"))
      .finally(() => setLoading(false));
  }, [applied]);

  const hasFilters = useMemo(() => vacancyOptions.length > 0, [vacancyOptions]);

  // Anchors + rounds combined into one comparable list so Recruitment
  // Progress can render as proportional bars (relative to whichever stage
  // has the most candidates) instead of a grid of same-size boxes.
  const progressRows: ProgressRow[] = useMemo(() => {
    if (!data || !data.hasDepartment) return [];
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
    <div className="mgd-page">
      {/* Title styling and the divider below it match VacanciesPage's
          "Vacancies" heading exactly, per direct user request (applied to
          HM's dashboard first, mirrored here for a consistent look across
          all three role dashboards); the descriptive subtitle was dropped. */}
      <h1 className="mgd-title">Department Recruitment</h1>
      <div className="mgd-divider" />

      {loading && <p className="mgd-muted">Loading...</p>}
      {error && <p className="mgd-error">{error}</p>}

      {data && !data.hasDepartment && (
        <p className="mgd-muted">
          No department is set on your account, so there's nothing to scope this dashboard to yet - ask IT Admin to set your department.
        </p>
      )}

      {data && data.hasDepartment && (
        <>
          {hasFilters && (
            <div className="mgd-filter-bar">
              <div className="mgd-filter-field">
                <label>Date Range</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
                  <option value="">All time</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
              <div className="mgd-filter-field">
                <label>Vacancy</label>
                <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
                  <option value="">All vacancies</option>
                  {vacancyOptions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </div>
              <button className="mgd-apply-btn" onClick={() => setApplied({ dateRange, vacancyFilter })}>Apply</button>
            </div>
          )}

          <div className="mgd-kpi-grid">
            <div className="mgd-kpi-tile mgd-kpi-tile--blue">
              <div className="mgd-kpi-label">Open Vacancies</div>
              <div className="mgd-kpi-value">{data.openVacancies}</div>
            </div>
            <div className="mgd-kpi-tile mgd-kpi-tile--gold">
              <div className="mgd-kpi-label">Active Candidates</div>
              <div className="mgd-kpi-value">{data.activeCandidates}</div>
            </div>
            <div className="mgd-kpi-tile mgd-kpi-tile--green">
              <div className="mgd-kpi-label">Hires This Month</div>
              <div className="mgd-kpi-value">{data.hiresThisMonth}</div>
            </div>
            <div className="mgd-kpi-tile mgd-kpi-tile--red">
              <div className="mgd-kpi-label">Rejected</div>
              <div className="mgd-kpi-value">{data.rejected}</div>
            </div>
          </div>

          {/* Follow-up correction: "Needs Attention" moved to its own Follow
              Ups tab -- it was actionable watch-list content sitting next to
              an overview panel, and duplicated ground the Candidate Progress
              page already covers in more detail. */}
          <div className="mgd-panel">
            <h2 className="mgd-section-title">Recruitment Progress</h2>
            <p className="mgd-muted">Across every vacancy in your department.</p>
            <div className="mgd-progress-list">
              {progressRows.map((r) => (
                <div key={r.key} className="mgd-progress-row">
                  <span className="mgd-progress-row-label">{r.label}</span>
                  <div className="mgd-progress-row-track">
                    <div
                      className={`mgd-progress-row-fill mgd-progress-row-fill--${r.accent}`}
                      style={{ width: `${Math.max(4, (r.count / maxProgressCount) * 100)}%` }}
                    />
                  </div>
                  <span className="mgd-progress-row-value">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
