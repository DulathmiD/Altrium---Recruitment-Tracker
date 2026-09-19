import { useEffect, useMemo, useState } from "react";
import {
  getLeadershipDashboard,
  listLeadershipDepartments,
  listLeadershipVacancies,
  type LeadershipDashboard,
  type LeadershipVacancyOption,
} from "../../api/leadership";
import "./RecruitmentOverviewPage.css";

type DateRangeFilter = "" | "30" | "90";

// Visual redesign pass, per direct user feedback ("recreate the dashboards
// ... make it nice and legite and corporate like and proffesional"): same
// data/instructions as before, just restyled -- same pattern as the Hiring
// Manager and Management dashboards, for a consistent look across every
// role. Accent colors are pulled straight from the status-pill palette
// already used across the app (CandidatesPage.css's .cnd-status-* colors),
// not invented new.
type ProgressRow = { key: string; label: string; count: number; accent: "green" | "gold" | "red" | "blue" };

export default function RecruitmentOverviewPage() {
  const [data, setData] = useState<LeadershipDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [departments, setDepartments] = useState<string[]>([]);
  const [vacancyOptions, setVacancyOptions] = useState<LeadershipVacancyOption[]>([]);

  const [dateRange, setDateRange] = useState<DateRangeFilter>("");
  const [department, setDepartment] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [applied, setApplied] = useState({ dateRange, department, vacancyFilter });

  useEffect(() => {
    listLeadershipDepartments().then((res) => setDepartments(res.departments));
  }, []);

  useEffect(() => {
    listLeadershipVacancies(department || undefined).then((res) => setVacancyOptions(res.vacancies));
    setVacancyFilter("");
  }, [department]);

  useEffect(() => {
    setLoading(true);
    getLeadershipDashboard({
      dateRange: applied.dateRange || undefined,
      department: applied.department || undefined,
      vacancyId: applied.vacancyFilter ? Number(applied.vacancyFilter) : undefined,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load recruitment overview"))
      .finally(() => setLoading(false));
  }, [applied]);

  const hasVacancies = useMemo(() => vacancyOptions.length > 0, [vacancyOptions]);

  // Anchors + rounds combined into one comparable list so Recruitment
  // Progress can render as proportional bars (relative to whichever stage
  // has the most candidates) instead of a grid of same-size boxes.
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
    <div className="ro-page">
      {/* Title styling and the divider below it match VacanciesPage's
          "Vacancies" heading exactly, per direct user request (applied to
          HM's dashboard first, mirrored here for a consistent look across
          all three role dashboards); the descriptive subtitle was dropped. */}
      <h1 className="ro-title">Recruitment Overview</h1>
      <div className="ro-divider" />

      <div className="ro-filter-bar">
        <div className="ro-filter-field">
          <label>Date Range</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
            <option value="">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div className="ro-filter-field">
          <label>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="ro-filter-field">
          <label>Vacancy</label>
          <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)} disabled={!hasVacancies}>
            <option value="">All vacancies</option>
            {vacancyOptions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </div>
        <button className="ro-apply-btn" onClick={() => setApplied({ dateRange, department, vacancyFilter })}>Apply</button>
      </div>

      {loading && <p className="ro-muted">Loading...</p>}
      {error && <p className="ro-error">{error}</p>}

      {data && (
        <>
          <div className="ro-kpi-grid">
            <div className="ro-kpi-tile ro-kpi-tile--blue">
              <div className="ro-kpi-label">Open Vacancies</div>
              <div className="ro-kpi-value">{data.openVacancies}</div>
            </div>
            <div className="ro-kpi-tile ro-kpi-tile--gold">
              <div className="ro-kpi-label">Active Candidates</div>
              <div className="ro-kpi-value">{data.activeCandidates}</div>
            </div>
            <div className="ro-kpi-tile ro-kpi-tile--green">
              <div className="ro-kpi-label">Hires This Month</div>
              <div className="ro-kpi-value">{data.hiresThisMonth}</div>
            </div>
            <div className="ro-kpi-tile ro-kpi-tile--red">
              <div className="ro-kpi-label">Rejected</div>
              <div className="ro-kpi-value">{data.rejected}</div>
            </div>
          </div>

          {/* Corrections doc: "Needs Attention" removed outright for
              Leadership per explicit instruction -- not moved to a tab, not
              kept as a dashboard panel, gone. Leadership is a pure observer
              role (never a panelist, no decisions to record, nothing here
              was ever actionable -- confirmed by every attentionItems entry
              already having link: null even before this). If asked to bring
              it back: `data.attentionItems` is still fetched and typed on
              `LeadershipDashboard` (api/leadership.ts) and still computed
              server-side (leadership.controller.ts's buildDashboardData) --
              nothing was ripped out of the data layer, only this render.
              The removed JSX (a two-column ro-lower-grid with an ro-attention
              panel next to Recruitment Progress) and its CSS are recoverable
              from project-decisions-log.md's "Leadership Follow Ups"
              entries if that day comes. */}
          <div className="ro-panel">
            <h2 className="ro-section-title">Recruitment Progress</h2>
            <p className="ro-muted">Candidates currently at each stage, across all vacancies.</p>
            <div className="ro-progress-list">
              {progressRows.map((r) => (
                <div key={r.key} className="ro-progress-row">
                  <span className="ro-progress-row-label">{r.label}</span>
                  <div className="ro-progress-row-track">
                    <div
                      className={`ro-progress-row-fill ro-progress-row-fill--${r.accent}`}
                      style={{ width: `${Math.max(4, (r.count / maxProgressCount) * 100)}%` }}
                    />
                  </div>
                  <span className="ro-progress-row-value">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
