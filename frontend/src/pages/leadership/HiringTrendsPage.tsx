import { useEffect, useState } from "react";
import { getHiringTrends, listLeadershipDepartments, listLeadershipVacancies, type HiringTrendsResponse, type LeadershipVacancyOption } from "../../api/leadership";
import "./HiringTrendsPage.css";

type DateRangeFilter = "" | "30" | "90";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const CHART_PAD = 32;

function buildLinePath(values: number[]): { path: string; points: { x: number; y: number }[] } {
  if (values.length === 0) return { path: "", points: [] };
  const max = Math.max(1, ...values);
  const stepX = (CHART_WIDTH - CHART_PAD * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = CHART_PAD + i * stepX;
    const y = CHART_HEIGHT - CHART_PAD - (v / max) * (CHART_HEIGHT - CHART_PAD * 2);
    return { x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return { path, points };
}

export default function HiringTrendsPage() {
  const [data, setData] = useState<HiringTrendsResponse | null>(null);
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
    getHiringTrends({
      dateRange: applied.dateRange || undefined,
      department: applied.department || undefined,
      vacancyId: applied.vacancyFilter ? Number(applied.vacancyFilter) : undefined,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load hiring trends"))
      .finally(() => setLoading(false));
  }, [applied]);

  const trend = data?.trend ?? [];
  const { path, points } = buildLinePath(trend.map((t) => t.count));

  return (
    <div className="ht-page">
      <h1 className="ht-title">Hiring Trends</h1>
      <div className="ht-divider" />

      <div className="ht-filter-bar">
        <div className="ht-filter-field">
          <label>Date Range</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}>
            <option value="">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div className="ht-filter-field">
          <label>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="ht-filter-field">
          <label>Vacancy</label>
          <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)}>
            <option value="">All vacancies</option>
            {vacancyOptions.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </div>
        <button className="ht-apply-btn" onClick={() => setApplied({ dateRange, department, vacancyFilter })}>Apply</button>
      </div>

      {loading && <p className="ht-muted">Loading...</p>}
      {error && <p className="ht-error">{error}</p>}

      {!loading && data && (
        <>
          <div className="ht-kpi-grid">
            <div className="ht-kpi-tile">
              <div className="ht-kpi-label">Applications</div>
              <div className="ht-kpi-value">{data.applications}</div>
            </div>
            <div className="ht-kpi-tile">
              <div className="ht-kpi-label">Candidates In Rounds</div>
              <div className="ht-kpi-value">{data.candidatesInRounds}</div>
            </div>
            <div className="ht-kpi-tile">
              <div className="ht-kpi-label">Hired</div>
              <div className="ht-kpi-value">{data.hired}</div>
            </div>
            <div className="ht-kpi-tile">
              <div className="ht-kpi-label">Rejected</div>
              <div className="ht-kpi-value">{data.rejected}</div>
            </div>
          </div>

          <h2 className="ht-panel-title">Hires per Month</h2>
          <div className="ht-chart-panel">
            {trend.length === 0 ? (
              <p className="ht-muted">No hiring data yet.</p>
            ) : (
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="ht-chart-svg">
                <line x1={CHART_PAD} y1={CHART_HEIGHT - CHART_PAD} x2={CHART_WIDTH - CHART_PAD} y2={CHART_HEIGHT - CHART_PAD} className="ht-chart-axis" />
                <path d={path} className="ht-chart-line" fill="none" />
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={4} className="ht-chart-dot" />
                    <text x={p.x} y={p.y - 10} textAnchor="middle" className="ht-chart-value">{trend[i]!.count}</text>
                    <text x={p.x} y={CHART_HEIGHT - CHART_PAD + 18} textAnchor="middle" className="ht-chart-axis-label">{trend[i]!.label}</text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </>
      )}
    </div>
  );
}
