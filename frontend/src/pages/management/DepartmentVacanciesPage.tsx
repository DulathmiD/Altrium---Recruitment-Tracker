import { useEffect, useMemo, useState } from "react";
import { getDepartmentVacancies, type ManagementVacancy } from "../../api/management";
import { fillTimelineStatus, daysOpen, type FillTimelineStatus } from "../../api/vacancy";
import "./DepartmentVacanciesPage.css";

const STATUS_LABELS: Record<FillTimelineStatus, string> = {
  ON_TRACK: "On track",
  DELAYED: "Delayed",
  OVERDUE: "Overdue",
  NO_TARGET: "On track",
};

const STATUS_CLASS: Record<FillTimelineStatus, string> = {
  ON_TRACK: "dv-status dv-status-ontrack",
  DELAYED: "dv-status dv-status-delayed",
  OVERDUE: "dv-status dv-status-overdue",
  NO_TARGET: "dv-status dv-status-ontrack",
};

type DateRangeFilter = "" | "30" | "90";

export default function DepartmentVacanciesPage() {
  const [hasDepartment, setHasDepartment] = useState(true);
  const [vacancies, setVacancies] = useState<ManagementVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateRange, setDateRange] = useState<DateRangeFilter>("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [applied, setApplied] = useState({ dateRange, vacancyFilter });

  useEffect(() => {
    setLoading(true);
    getDepartmentVacancies({ dateRange: applied.dateRange || undefined, vacancyId: applied.vacancyFilter ? Number(applied.vacancyFilter) : undefined })
      .then((res) => {
        if (!res.hasDepartment) {
          setHasDepartment(false);
          return;
        }
        setVacancies(res.vacancies);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vacancies"))
      .finally(() => setLoading(false));
  }, [applied]);

  // Vacancy options come from the unfiltered-by-vacancy set so the dropdown
  // doesn't shrink to just whatever's already showing once a filter's applied.
  const [allVacancies, setAllVacancies] = useState<ManagementVacancy[]>([]);
  useEffect(() => {
    getDepartmentVacancies().then((res) => {
      if (res.hasDepartment) setAllVacancies(res.vacancies);
    });
  }, []);

  const vacancyOptions = useMemo(() => allVacancies, [allVacancies]);

  return (
    <div className="dv-page">
      <h1 className="dv-title">Department Vacancies</h1>
      <div className="dv-divider" />

      {!hasDepartment && (
        <p className="dv-muted">No department is set on your account, so there's nothing to scope this to yet -- ask IT Admin to set your department.</p>
      )}

      {hasDepartment && (
        <>
          <div className="dv-filter-bar">
            <div className="dv-filter-field">
              <label>Date Range</label>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
                <option value="">All time</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            <div className="dv-filter-field">
              <label>Vacancy</label>
              <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
                <option value="">All vacancies</option>
                {vacancyOptions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            </div>
            <button className="dv-apply-btn" onClick={() => setApplied({ dateRange, vacancyFilter })}>Apply</button>
          </div>

          {loading && <p className="dv-muted">Loading...</p>}
          {error && <p className="dv-error">{error}</p>}
          {!loading && vacancies.length === 0 && <p className="dv-muted">No vacancies match those filters.</p>}

          {!loading && vacancies.length > 0 && (
            <table className="dv-table">
              <thead>
                <tr>
                  <th>Vacancy</th>
                  <th>Department</th>
                  <th>Current Stage</th>
                  <th>Candidates</th>
                  <th>Days Open</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((v) => {
                  const status = fillTimelineStatus(v);
                  return (
                    <tr key={v.id}>
                      <td>{v.title}</td>
                      <td>{v.department}</td>
                      <td>{v.currentStage}</td>
                      <td>{v.candidateCount}</td>
                      <td>{daysOpen(v)}</td>
                      <td><span className={STATUS_CLASS[status]}>{STATUS_LABELS[status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
