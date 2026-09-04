import { useEffect, useMemo, useState } from "react";
import { getManagementDashboard, getDepartmentVacancies, type ManagementDashboard, type ManagementVacancy } from "../../api/management";
import "./DashboardPage.css";

type DateRangeFilter = "" | "30" | "90";

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

  return (
    <div className="mgd-page">
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
            <div className="mgd-kpi-tile">
              <div className="mgd-kpi-label">Open Vacancies</div>
              <div className="mgd-kpi-value">{data.openVacancies}</div>
            </div>
            <div className="mgd-kpi-tile">
              <div className="mgd-kpi-label">Active Candidates</div>
              <div className="mgd-kpi-value">{data.activeCandidates}</div>
            </div>
            <div className="mgd-kpi-tile">
              <div className="mgd-kpi-label">Hires This Month</div>
              <div className="mgd-kpi-value">{data.hiresThisMonth}</div>
            </div>
            <div className="mgd-kpi-tile">
              <div className="mgd-kpi-label">Rejected</div>
              <div className="mgd-kpi-value">{data.rejected}</div>
            </div>
          </div>

          {/* Follow-up correction: "Needs Attention" moved to its own Follow
              Ups tab -- it was actionable watch-list content sitting next to
              an overview panel, and duplicated ground the Candidate Progress
              page already covers in more detail. */}
          <div className="mgd-progress-col">
            <h2 className="mgd-section-title">Recruitment Progress</h2>
            <p className="mgd-muted">Across every vacancy in your department.</p>
            <div className="mgd-progress-grid">
              {data.anchors
                .filter((a) => a.stage !== "APPLIED")
                .map((a) => (
                  <div key={a.stage} className="mgd-progress-tile">
                    <div className="mgd-progress-value">{a.candidateCount}</div>
                    <div className="mgd-kpi-label">{a.label}</div>
                  </div>
                ))}
              {data.rounds.map((r) => (
                <div key={r.order} className="mgd-progress-tile">
                  <div className="mgd-progress-value">{r.candidateCount}</div>
                  <div className="mgd-kpi-label">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
