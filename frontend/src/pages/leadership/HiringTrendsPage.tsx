import { useCallback, useEffect, useRef, useState } from "react";
import { getHiringTrends, listLeadershipDepartments, listLeadershipVacancies, type HiringTrendsResponse, type LeadershipVacancyOption } from "../../api/leadership";
import "./HiringTrendsPage.css";

type DateRangeFilter = "" | "30" | "90";

// Was 260/34/36 -- with the panel's own padding on top, the box read as too
// tall for how little vertical range the actual line/dots use (most months
// sit near the baseline). Trimmed the chart itself and the panel's padding
// together so the box hugs the chart rather than floating it in a lot of
// empty white space.
const CHART_HEIGHT = 210;
const CHART_PAD_X = 20;
const CHART_PAD_TOP = 28;
const CHART_PAD_BOTTOM = 32;

type ChartPoint = { x: number; y: number };

// Catmull-Rom-to-Bezier smoothing -- turns the raw point-to-point polyline
// into a gently curved line instead of sharp straight-line joints, which
// read as "basic" against the rest of the app's rounded, soft-shadow style.
function buildSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function buildChart(values: number[], width: number) {
  if (values.length === 0) return { points: [] as ChartPoint[], linePath: "", areaPath: "", gridLines: [] as number[], max: 1 };
  const max = Math.max(1, ...values);
  const usableW = width - CHART_PAD_X * 2;
  const usableH = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const baseline = CHART_HEIGHT - CHART_PAD_BOTTOM;
  const stepX = values.length > 1 ? usableW / (values.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: CHART_PAD_X + i * stepX,
    y: baseline - (v / max) * usableH,
  }));
  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1]!.x},${baseline} L${points[0]!.x},${baseline} Z`
    : "";
  const gridLines = [0.25, 0.5, 0.75].map((frac) => CHART_PAD_TOP + frac * usableH);
  return { points, linePath, areaPath, gridLines, max };
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

  // The old chart used a fixed 720x220 viewBox with preserveAspectRatio="none",
  // which stretches x and y independently whenever the actual rendered panel
  // width doesn't match a 720:220 ratio -- in practice it almost never does,
  // so the "circular" dots were rendered as flattened ellipses and the whole
  // chart read as warped/"3D". Measuring the real panel width and using it as
  // the viewBox width keeps the coordinate system 1:1 with the rendered
  // pixels, so nothing needs to be non-uniformly stretched.
  //
  // Follow-up correction: this used to attach the ResizeObserver in a plain
  // `useEffect(..., [])`, which runs once on mount -- but `.ht-chart-wrap`
  // only exists once `data` has loaded (it's behind the `trend.length === 0`
  // check below), so on first mount the ref was still null, the effect's
  // early `if (!el) return` fired, and no observer was ever attached.
  // chartWidth stayed stuck at its 720px default forever, so the chart never
  // actually grew when the panel around it did. A callback ref fixes this
  // properly: it fires exactly when the div mounts (whenever that happens,
  // including after the async data load) and attaches a fresh observer then.
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [chartWidth, setChartWidth] = useState(720);

  const chartWrapRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setChartWidth(w);
    });
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);

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
  const { points, linePath, areaPath, gridLines } = buildChart(trend.map((t) => t.count), chartWidth);

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
            <div className="ht-kpi-tile ht-kpi-tile--blue">
              <div className="ht-kpi-label">Applications</div>
              <div className="ht-kpi-value">{data.applications}</div>
            </div>
            <div className="ht-kpi-tile ht-kpi-tile--gold">
              <div className="ht-kpi-label">Candidates In Rounds</div>
              <div className="ht-kpi-value">{data.candidatesInRounds}</div>
            </div>
            <div className="ht-kpi-tile ht-kpi-tile--green">
              <div className="ht-kpi-label">Hired</div>
              <div className="ht-kpi-value">{data.hired}</div>
            </div>
            <div className="ht-kpi-tile ht-kpi-tile--red">
              <div className="ht-kpi-label">Rejected</div>
              <div className="ht-kpi-value">{data.rejected}</div>
            </div>
          </div>

          <h2 className="ht-panel-title">Hires per Month</h2>
          <div className="ht-chart-panel">
            {trend.length === 0 ? (
              <p className="ht-muted">No hiring data yet.</p>
            ) : (
              <div className="ht-chart-wrap" ref={chartWrapRef}>
                <svg viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} className="ht-chart-svg">
                  <defs>
                    <linearGradient id="htAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" className="ht-chart-area-stop-start" />
                      <stop offset="100%" className="ht-chart-area-stop-end" />
                    </linearGradient>
                  </defs>
                  {gridLines.map((y, i) => (
                    <line key={i} x1={CHART_PAD_X} y1={y} x2={chartWidth - CHART_PAD_X} y2={y} className="ht-chart-grid-line" />
                  ))}
                  <line x1={CHART_PAD_X} y1={CHART_HEIGHT - CHART_PAD_BOTTOM} x2={chartWidth - CHART_PAD_X} y2={CHART_HEIGHT - CHART_PAD_BOTTOM} className="ht-chart-axis" />
                  <path d={areaPath} fill="url(#htAreaGradient)" stroke="none" />
                  <path d={linePath} className="ht-chart-line" fill="none" />
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={5} className="ht-chart-dot-outer" />
                      <circle cx={p.x} cy={p.y} r={2.5} className="ht-chart-dot-inner" />
                      <text x={p.x} y={p.y - 14} textAnchor="middle" className="ht-chart-value">{trend[i]!.count}</text>
                      <text x={p.x} y={CHART_HEIGHT - CHART_PAD_BOTTOM + 22} textAnchor="middle" className="ht-chart-axis-label">{trend[i]!.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
