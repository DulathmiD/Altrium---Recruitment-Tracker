import { useEffect, useMemo, useState } from "react";
import { getUpcomingInterviews, type UpcomingInterviewRow } from "../../api/management";
import "./MyInterviewsPage.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local (not UTC) YYYY-MM-DD -- mirrors the identical helper in HR's/
// Interviewer's calendar pages, same reasoning (Date.toISOString() shifts to
// UTC first, which can land on the wrong calendar day).
function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Corrections doc: "add a calendar for the upcoming interview part" --
// rebuilt on the same month-grid pattern as HR's/Interviewer's calendars,
// scoped to this Management user's department (getUpcomingInterviews already
// does that server-side).
// Follow-up correction: renamed "Upcoming Interviews" -> "My Interviews"
// (consistent with the same rename made on HM's calendar tab) and the
// vacancy filter dropped entirely -- Management oversees exactly one
// department, so filtering this calendar by vacancy never meaningfully
// narrowed anything down, it was just an extra click before every glance at
// the calendar.
export default function MyInterviewsPage() {
  const [hasDepartment, setHasDepartment] = useState(true);
  const [rows, setRows] = useState<UpcomingInterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getUpcomingInterviews()
      .then((res) => {
        if (!res.hasDepartment) {
          setHasDepartment(false);
          return;
        }
        setRows(res.rows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your interviews"))
      .finally(() => setLoading(false));
  }, []);

  const monthStart = useMemo(() => {
    const d = new Date(monthCursor);
    d.setDate(1);
    return d;
  }, [monthCursor]);
  const monthEnd = useMemo(() => {
    const d = new Date(monthCursor);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  }, [monthCursor]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, UpcomingInterviewRow[]>();
    for (const r of rows) {
      const key = localYmd(new Date(r.scheduledAt));
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }
    return map;
  }, [rows]);

  const gridCells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    return cells;
  }, [monthStart, monthEnd]);

  return (
    <div className="mi-page">
      <h1 className="mi-title">My Interviews</h1>
      <div className="mi-divider" />

      {!hasDepartment && (
        <p className="mi-muted">No department is set on your account, so there's nothing to scope this to yet -- ask IT Admin to set your department.</p>
      )}

      {hasDepartment && (
        <>
          {error && <p className="mi-error">{error}</p>}
          {loading && <p className="mi-muted">Loading...</p>}

          {!loading && (
            <div className="mi-body">
              <div className={`mi-calendar-wrap${selectedDate ? " mi-calendar-shrunk" : ""}`}>
                <div className="mi-calendar-nav">
                  <button
                    type="button"
                    onClick={() =>
                      setMonthCursor((d) => {
                        const n = new Date(d);
                        n.setMonth(n.getMonth() - 1);
                        return n;
                      })
                    }
                  >
                    &#8249;
                  </button>
                  <span>{monthStart.toLocaleString("en-GB", { month: "long", year: "numeric" })}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setMonthCursor((d) => {
                        const n = new Date(d);
                        n.setMonth(n.getMonth() + 1);
                        return n;
                      })
                    }
                  >
                    &#8250;
                  </button>
                </div>
                <div className="mi-calendar-grid">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="mi-calendar-weekday">
                      {w}
                    </div>
                  ))}
                  {gridCells.map((d, i) => {
                    if (!d) return <div key={`blank-${i}`} className="mi-calendar-cell mi-calendar-cell-empty" />;
                    const key = localYmd(d);
                    const dayRows = rowsByDate.get(key) ?? [];
                    const hasInterviews = dayRows.length > 0;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`mi-calendar-cell${hasInterviews ? " mi-calendar-cell-active" : ""}${
                          selectedDate === key ? " mi-calendar-cell-selected" : ""
                        }`}
                        onClick={() => (hasInterviews ? setSelectedDate(key) : undefined)}
                        disabled={!hasInterviews}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDate && (
                <div className="mi-side-panel">
                  <div className="mi-side-panel-header">
                    <h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
                    <button type="button" className="mi-side-panel-close" onClick={() => setSelectedDate(null)} aria-label="Close">
                      &#10005;
                    </button>
                  </div>
                  <div className="mi-slot-list">
                    {(rowsByDate.get(selectedDate) ?? []).map((r) => (
                      <div key={r.interviewId} className="mi-slot-row">
                        <span className="mi-slot-time">
                          {new Date(r.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="mi-slot-label">
                          {r.vacancy.title} - Round {r.round.order}
                        </span>
                        <span className="mi-slot-candidate">{r.candidate.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
