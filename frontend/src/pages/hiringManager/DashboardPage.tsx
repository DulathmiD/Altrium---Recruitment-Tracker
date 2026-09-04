import { useEffect, useMemo, useState } from "react";
import { getMyDashboard, getMyVacancies, type HmDashboard, type HmVacancy } from "../../api/hiringManager";
import "./DashboardPage.css";

type DateRangeFilter = "ALL" | "30" | "90";

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

  return (
    <div className="hmd-page">
      <h1 className="hmd-title">Hiring Manager Dashboard</h1>
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
            <div className="hmd-kpi-tile">
              <div className="hmd-kpi-label">Open Vacancies</div>
              <div className="hmd-kpi-value">{data.openVacancies}</div>
            </div>
            <div className="hmd-kpi-tile">
              <div className="hmd-kpi-label">Awaiting My Decision</div>
              <div className="hmd-kpi-value">{data.awaitingMyDecision}</div>
            </div>
            <div className="hmd-kpi-tile">
              <div className="hmd-kpi-label">Hired</div>
              <div className="hmd-kpi-value">{data.hired}</div>
            </div>
            <div className="hmd-kpi-tile">
              <div className="hmd-kpi-label">Rejected</div>
              <div className="hmd-kpi-value">{data.rejected}</div>
            </div>
          </div>

          <div className="hmd-progress-col">
            <h2 className="hmd-section-title">Recruitment Progress</h2>
            <p className="hmd-muted">Across every vacancy you're involved in.</p>
            <div className="hmd-progress-grid">
              {data.anchors
                .filter((a) => a.stage !== "APPLIED")
                .map((a) => (
                  <div key={a.stage} className="hmd-progress-tile">
                    <div className="hmd-progress-value">{a.candidateCount}</div>
                    <div className="hmd-kpi-label">{a.label}</div>
                  </div>
                ))}
              {data.rounds.map((r) => (
                <div key={r.order} className="hmd-progress-tile">
                  <div className="hmd-progress-value">{r.candidateCount}</div>
                  <div className="hmd-kpi-label">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
