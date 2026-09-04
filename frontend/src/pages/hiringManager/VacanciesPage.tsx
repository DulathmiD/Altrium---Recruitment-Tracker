import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyVacancies, type HmVacancy } from "../../api/hiringManager";
import { fillTimelineStatus, daysOpen, type FillTimelineStatus } from "../../api/vacancy";
import "./VacanciesPage.css";

const STATUS_LABELS: Record<FillTimelineStatus, string> = {
  ON_TRACK: "On track",
  DELAYED: "Delayed",
  OVERDUE: "Overdue",
  NO_TARGET: "On track",
};

const STATUS_CLASS: Record<FillTimelineStatus, string> = {
  ON_TRACK: "hmv-status hmv-status-ontrack",
  DELAYED: "hmv-status hmv-status-delayed",
  OVERDUE: "hmv-status hmv-status-overdue",
  NO_TARGET: "hmv-status hmv-status-ontrack",
};

// Overdue/Delayed float to the top within the still-active vacancies --
// fully-decided ones (see allDecided below) always sink to the very bottom
// regardless of status, since there's nothing left to act on.
const STATUS_SEVERITY: Record<FillTimelineStatus, number> = {
  OVERDUE: 0,
  DELAYED: 1,
  ON_TRACK: 2,
  NO_TARGET: 3,
};

type DateRangeFilter = "ALL" | "30" | "90";

export default function VacanciesPage() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<HmVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateRange, setDateRange] = useState<DateRangeFilter>("ALL");
  const [department, setDepartment] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [status, setStatus] = useState<FillTimelineStatus | "">("");
  const [appliedFilters, setAppliedFilters] = useState({ dateRange, department, vacancyFilter, status });

  useEffect(() => {
    getMyVacancies()
      .then(setVacancies)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vacancies"))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => [...new Set(vacancies.map((v) => v.department))].sort(), [vacancies]);

  const visibleVacancies = useMemo(() => {
    const now = new Date();
    let rows = vacancies;

    if (appliedFilters.dateRange !== "ALL") {
      const days = Number(appliedFilters.dateRange);
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      rows = rows.filter((v) => new Date(v.createdAt) >= cutoff);
    }
    if (appliedFilters.department) {
      rows = rows.filter((v) => v.department === appliedFilters.department);
    }
    if (appliedFilters.vacancyFilter) {
      rows = rows.filter((v) => v.id === Number(appliedFilters.vacancyFilter));
    }
    if (appliedFilters.status) {
      rows = rows.filter((v) => fillTimelineStatus(v) === appliedFilters.status);
    }

    return [...rows].sort((a, b) => {
      if (a.allDecided !== b.allDecided) return a.allDecided ? 1 : -1;
      const sa = STATUS_SEVERITY[fillTimelineStatus(a)];
      const sb = STATUS_SEVERITY[fillTimelineStatus(b)];
      if (sa !== sb) return sa - sb;
      return a.title.localeCompare(b.title);
    });
  }, [vacancies, appliedFilters]);

  return (
    <div className="hmv-page">
      <h1 className="hmv-title">Vacancies</h1>
      <div className="hmv-divider" />

      {loading && <p className="hmv-muted">Loading...</p>}
      {error && <p className="hmv-error">{error}</p>}
      {!loading && vacancies.length === 0 && (
        <p className="hmv-muted">You're not assigned to any vacancies yet.</p>
      )}

      {!loading && vacancies.length > 0 && (
        <>
          <div className="hmv-filter-bar">
            <div className="hmv-filter-fields">
              <div className="hmv-filter-field">
                <label>Date Range</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
                  <option value="ALL">All time</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
              <div className="hmv-filter-field">
                <label>Department</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="hmv-filter-field">
                <label>Vacancy</label>
                <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
                  <option value="">All vacancies</option>
                  {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </div>
              <div className="hmv-filter-field">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as FillTimelineStatus | "")}>
                  <option value="">All statuses</option>
                  <option value="ON_TRACK">On track</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>
            </div>
            <button
              className="hmv-apply-btn"
              onClick={() => setAppliedFilters({ dateRange, department, vacancyFilter, status })}
            >
              Apply
            </button>
          </div>

          <p className="hmv-muted">All Vacancies</p>
          {visibleVacancies.length === 0 ? (
            <p className="hmv-muted">No vacancies match those filters.</p>
          ) : (
            <table className="hmv-table">
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
                {visibleVacancies.map((v) => {
                  const statusValue = fillTimelineStatus(v);
                  return (
                    <tr
                      key={v.id}
                      className="hmv-row"
                      onClick={() => navigate(`/hiring-manager/vacancies/${v.id}/candidates`)}
                    >
                      <td>{v.title}</td>
                      <td>{v.department}</td>
                      <td>{v.currentStage}</td>
                      <td>{v.candidateCount}</td>
                      <td>{daysOpen(v)}</td>
                      <td><span className={STATUS_CLASS[statusValue]}>{STATUS_LABELS[statusValue]}</span></td>
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
