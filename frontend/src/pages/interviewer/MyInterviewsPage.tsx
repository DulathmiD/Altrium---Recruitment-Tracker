import { useEffect, useMemo, useState } from "react";
import { listMyInterviews, type MyInterview } from "../../api/interviews";
import { formatSlotTimeRange } from "../../utils/interviewTime";
import "./MyInterviewsPage.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local (not UTC) YYYY-MM-DD -- Date.toISOString() shifts to UTC first, which
// can land on the wrong calendar day depending on the browser's timezone.
// Mirrors the identical helper in HR's InterviewsPage.tsx.
function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Corrections doc: "make [My Interviews] the calendar in HR" -- rebuilt on
// the same month-grid pattern as HR's InterviewsPage.tsx, scoped to just this
// interviewer's own interviews (listMyInterviews already filters server-side
// by the logged-in interviewer). The old flat sortable table that used to
// live here moved to My Candidates instead (locked answer, see
// MyCandidatesPage.tsx), so this page is calendar-only now.
export default function MyInterviewsPage() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [rows, setRows] = useState<MyInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedInterviewId, setSelectedInterviewId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    listMyInterviews()
      .then(setRows)
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
    const map = new Map<string, MyInterview[]>();
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

  const selectedInterview = useMemo(
    () => rows.find((r) => r.id === selectedInterviewId) ?? null,
    [rows, selectedInterviewId]
  );

  function closeAllPanels() {
    setSelectedDate(null);
    setSelectedInterviewId(null);
  }

  return (
    <div className="miv-page">
      <h1 className="miv-title">My Interviews</h1>
      <div className="miv-divider" />

      {error && <p className="miv-error">{error}</p>}
      {loading && <p className="miv-muted">Loading...</p>}

      {!loading && (
        <div className="miv-body">
          <div className={`miv-calendar-wrap${selectedDate ? " miv-calendar-shrunk" : ""}`}>
            <div className="miv-calendar-nav">
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
            <div className="miv-calendar-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="miv-calendar-weekday">
                  {w}
                </div>
              ))}
              {gridCells.map((d, i) => {
                if (!d) return <div key={`blank-${i}`} className="miv-calendar-cell miv-calendar-cell-empty" />;
                const key = localYmd(d);
                const dayRows = rowsByDate.get(key) ?? [];
                const hasInterviews = dayRows.length > 0;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`miv-calendar-cell${hasInterviews ? " miv-calendar-cell-active" : ""}${
                      selectedDate === key ? " miv-calendar-cell-selected" : ""
                    }`}
                    onClick={() => {
                      if (!hasInterviews) return;
                      setSelectedDate(key);
                      setSelectedInterviewId(null);
                    }}
                    disabled={!hasInterviews}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && !selectedInterviewId && (
            <div className="miv-side-panel">
              <div className="miv-side-panel-header">
                <h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
                <button type="button" className="miv-side-panel-close" onClick={closeAllPanels} aria-label="Close">
                  &#10005;
                </button>
              </div>
              {/* Same two-level drill-down as HR's InterviewsPage.tsx --
                  clicking a row opens a read-only detail view (below), it
                  never jumps straight to the Feedback form. Score/comment
                  entry only ever opens from My Candidates now. */}
              <div className="miv-slot-list">
                {(rowsByDate.get(selectedDate) ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="miv-slot-row"
                    onClick={() => setSelectedInterviewId(r.id)}
                  >
                    <span className="miv-slot-time">{formatSlotTimeRange(r.scheduledAt)}</span>
                    <span className="miv-slot-label">
                      {r.application.vacancy.title} - {r.vacancyStage.name}
                    </span>
                    <span className="miv-slot-count">1 candidate(s)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedInterviewId && selectedInterview && (
            <div className="miv-side-panel">
              <div className="miv-side-panel-header">
                <h2>
                  {selectedInterview.application.vacancy.title} - {selectedInterview.vacancyStage.name}
                </h2>
                <button
                  type="button"
                  className="miv-side-panel-close"
                  onClick={() => setSelectedInterviewId(null)}
                  aria-label="Close"
                >
                  &#10005;
                </button>
              </div>
              <p className="miv-muted">{new Date(selectedInterview.scheduledAt).toLocaleString()}</p>

              <h3 className="miv-section-heading">Panel</h3>
              <ul className="miv-plain-list">
                {selectedInterview.panelists.length === 0 && <li className="miv-muted">No panelists assigned.</li>}
                {selectedInterview.panelists.map((p) => (
                  <li key={p.id}>{p.user.name}</li>
                ))}
              </ul>

              <h3 className="miv-section-heading">Candidates</h3>
              <ul className="miv-plain-list">
                <li>
                  {selectedInterview.application.candidate.name}
                  {selectedInterview.feedbackSubmitted ? " - feedback submitted" : " - awaiting feedback"}
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
