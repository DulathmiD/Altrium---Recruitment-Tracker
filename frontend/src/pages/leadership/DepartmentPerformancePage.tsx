import { useEffect, useState } from "react";
import { getDepartmentPerformance, listLeadershipDepartments, listLeadershipVacancies, type DepartmentPerformanceResponse, type LeadershipVacancyOption } from "../../api/leadership";
import "./DepartmentPerformancePage.css";

type DateRangeFilter = "" | "30" | "90";

export default function DepartmentPerformancePage() {
  const [data, setData] = useState<DepartmentPerformanceResponse | null>(null);
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
    getDepartmentPerformance({
      dateRange: applied.dateRange || undefined,
      department: applied.department || undefined,
      vacancyId: applied.vacancyFilter ? Number(applied.vacancyFilter) : undefined,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load department performance"))
      .finally(() => setLoading(false));
  }, [applied]);

  const maxHired = data ? Math.max(1, ...data.hiredByDepartment.map((d) => d.count)) : 1;
  const maxRejected = data ? Math.max(1, ...data.rejectedByDepartment.map((d) => d.count)) : 1;

  return (
    <div className="dp-page">
      <h1 className="dp-title">Department Performance</h1>
      <div className="dp-divider" />

      <div className="dp-filter-bar">
        <div className="dp-filter-field">
          <label>Date Range</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
            <option value="">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div className="dp-filter-field">
          <label>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="dp-filter-field">
          <label>Vacancy</label>
          <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
            <option value="">All vacancies</option>
            {vacancyOptions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </div>
        <button className="dp-apply-btn" onClick={() => setApplied({ dateRange, department, vacancyFilter })}>Apply</button>
      </div>

      {loading && <p className="dp-muted">Loading...</p>}
      {error && <p className="dp-error">{error}</p>}

      {!loading && data && (
        <>
          <div className="dp-kpi-grid">
            <div className="dp-kpi-tile">
              <div className="dp-kpi-label">Best Fill Rate</div>
              <div className="dp-kpi-value">{data.summary.bestFillRate ? `${data.summary.bestFillRate.value}%` : "--"}</div>
              <div className="dp-kpi-sub">{data.summary.bestFillRate?.department ?? ""}</div>
            </div>
            <div className="dp-kpi-tile">
              <div className="dp-kpi-label">Fastest Hiring</div>
              <div className="dp-kpi-value">{data.summary.fastestHiring ? `${data.summary.fastestHiring.days}d` : "--"}</div>
              <div className="dp-kpi-sub">{data.summary.fastestHiring?.department ?? ""}</div>
            </div>
            <div className="dp-kpi-tile">
              <div className="dp-kpi-label">Most Open Roles</div>
              <div className="dp-kpi-value">{data.summary.mostOpenRoles ? data.summary.mostOpenRoles.count : "--"}</div>
              <div className="dp-kpi-sub">{data.summary.mostOpenRoles?.department ?? ""}</div>
            </div>
            <div className="dp-kpi-tile">
              <div className="dp-kpi-label">Overdue Roles</div>
              <div className="dp-kpi-value">{data.summary.overdueRoles}</div>
              <div className="dp-kpi-sub">&nbsp;</div>
            </div>
          </div>

          <div className="dp-panels">
            <div className="dp-panel">
              <h2 className="dp-panel-title">Hired by Department</h2>
              <div className="dp-bar-list">
                {data.hiredByDepartment.map((d) => (
                  <div key={d.department} className="dp-bar-row">
                    <span className="dp-bar-label">{d.department}</span>
                    <div className="dp-bar-track">
                      <div className="dp-bar-fill dp-bar-fill-hired" style={{ width: `${(d.count / maxHired) * 100}%` }} />
                    </div>
                    <span className="dp-bar-value">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dp-panel">
              <h2 className="dp-panel-title">Rejected by Department</h2>
              <div className="dp-bar-list">
                {data.rejectedByDepartment.map((d) => (
                  <div key={d.department} className="dp-bar-row">
                    <span className="dp-bar-label">{d.department}</span>
                    <div className="dp-bar-track">
                      <div className="dp-bar-fill dp-bar-fill-rejected" style={{ width: `${(d.count / maxRejected) * 100}%` }} />
                    </div>
                    <span className="dp-bar-value">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h2 className="dp-panel-title dp-table-title">By Department</h2>
          <table className="dp-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Fill Rate</th>
                <th>Avg Time to Hire</th>
                <th>Open Roles</th>
                <th>Overdue</th>
                <th>Hired</th>
                <th>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.department}>
                  <td>{r.department}</td>
                  <td>{r.fillRate}%</td>
                  <td>{r.avgTimeToHireDays !== null ? `${r.avgTimeToHireDays}d` : "--"}</td>
                  <td>{r.openRoles}</td>
                  <td>{r.overdueRoles}</td>
                  <td>{r.hired}</td>
                  <td>{r.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
