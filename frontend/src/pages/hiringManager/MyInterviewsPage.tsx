// SUPERSEDED (corrections doc: "the hiring manager doesn't have an
// interview page") -- the HM isn't an interviewer/panelist; their role is
// deciding Proceed/Do Not Proceed/Hire/Reject from Pending Decisions, not
// sitting on interview panels. No longer imported/routed anywhere (removed
// from HMLayout.tsx's nav and App.tsx's routes); left in place, unused, for
// reference.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listMyInterviews, type MyInterview } from "../../api/interviews";
import { formatSlotTimeRange } from "../../utils/interviewTime";
import Toast from "../../components/Toast";
import "./MyInterviewsPage.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local (not UTC) YYYY-MM-DD -- Date.toISOString() shifts to UTC first, which
// can land on the wrong calendar day depending on the browser's timezone.
// Mirrors the identical helper in HR's InterviewsPage.tsx and Interviewer's
// MyInterviewsPage.tsx.
function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Follow-up correction: this is a calendar, not a flat table -- same
// month-grid + two-level drill-down as Interviewer's MyInterviewsPage.tsx
// (day -> that day's slots -> one slot's Panel + Candidates). The one real
// difference: Interviewer's version is read-only (feedback entry lives on
// its separate My Candidates tab); HM has no equivalent second tab -- HM's
// "candidates" already means the Vacancy Candidates list under Vacancies,
// so a second "candidates" page here would collide with that existing
// meaning. HM's Candidates line is therefore the one clickable path straight
// to the Feedback page.
// listMyInterviews is role-agnostic server-side (scoped by panelist
// membership, not role), so this reuses it exactly as-is. Naturally a
// shorter list than Interviewer's or Management's -- nothing requires an HM
// to attend any particular round the way Management now must for finals.
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
  const navigate = useNavigate();
  const location = useLocation();

  // The Feedback page navigates back here and hands off a one-shot success
  // message via route state (same pattern as Interviewer's/Management's My
  // Candidates pages).
  const [toast, setToast] = useState<string | null>(() => (location.state as { toast?: string } | null)?.toast ?? null);

  useEffect(() => {
    if (location.state && (location.state as { toast?: string }).toast) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="hmi-page">
      <h1 className="hmi-title">My Interviews</h1>
      <div className="hmi-divider" />

      {error && <p className="hmi-error">{error}</p>}
      {loading && <p className="hmi-muted">Loading...</p>}

      {!loading && (
        <div className="hmi-body">
          <div className={`hmi-calendar-wrap${selectedDate ? " hmi-calendar-shrunk" : ""}`}>
            <div className="hmi-calendar-nav">
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
            <div className="hmi-calendar-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="hmi-calendar-weekday">
                  {w}
                </div>
              ))}
              {gridCells.map((d, i) => {
                if (!d) return <div key={`blank-${i}`} className="hmi-calendar-cell hmi-calendar-cell-empty" />;
                const key = localYmd(d);
                const dayRows = rowsByDate.get(key) ?? [];
                const hasInterviews = dayRows.length > 0;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`hmi-calendar-cell${hasInterviews ? " hmi-calendar-cell-active" : ""}${
                      selectedDate === key ? " hmi-calendar-cell-selected" : ""
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
            <div className="hmi-side-panel">
              <div className="hmi-side-panel-header">
                <h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
                <button type="button" className="hmi-side-panel-close" onClick={closeAllPanels} aria-label="Close">
                  &#10005;
                </button>
              </div>
              <div className="hmi-slot-list">
                {(rowsByDate.get(selectedDate) ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="hmi-slot-row"
                    onClick={() => setSelectedInterviewId(r.id)}
                  >
                    <span className="hmi-slot-time">{formatSlotTimeRange(r.scheduledAt)}</span>
                    <span className="hmi-slot-label">
                      {r.application.vacancy.title} - {r.vacancyStage.name}
                    </span>
                    <span className="hmi-slot-count">1 candidate(s)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedInterviewId && selectedInterview && (
            <div className="hmi-side-panel">
              <div className="hmi-side-panel-header">
                <h2>
                  {selectedInterview.application.vacancy.title} - {selectedInterview.vacancyStage.name}
                </h2>
                <button
                  type="button"
                  className="hmi-side-panel-close"
                  onClick={() => setSelectedInterviewId(null)}
                  aria-label="Close"
                >
                  &#10005;
                </button>
              </div>
              <p className="hmi-muted">{new Date(selectedInterview.scheduledAt).toLocaleString()}</p>

              <h3 className="hmi-section-heading">Panel</h3>
              <ul className="hmi-plain-list">
                {selectedInterview.panelists.length === 0 && <li className="hmi-muted">No panelists assigned.</li>}
                {selectedInterview.panelists.map((p) => (
                  <li key={p.id}>{p.user.name}</li>
                ))}
              </ul>

              <h3 className="hmi-section-heading">Candidates</h3>
              {/* HM's one entry point to the Feedback page -- clicking this
                  candidate line submits/edits feedback for this interview. */}
              <button
                type="button"
                className="hmi-candidate-row"
                onClick={() => navigate(`/hiring-manager/my-interviews/${selectedInterview.id}/feedback`)}
              >
                {selectedInterview.application.candidate.name}
                {selectedInterview.feedbackSubmitted ? " - feedback submitted" : " - awaiting feedback"}
              </button>
            </div>
          )}
        </div>
      )}

      {toast && <Toast message={toast} duration={6000} dismissible onClose={() => setToast(null)} />}
    </div>
  );
}
