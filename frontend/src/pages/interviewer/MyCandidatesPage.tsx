import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listMyInterviews, type MyInterview } from "../../api/interviews";
import Toast from "../../components/Toast";
import "./MyCandidatesPage.css";

type FeedbackFilter = "ALL" | "SUBMITTED" | "PENDING";

// Corrections doc: this used to be a landing page grouped by vacancy+stage
// (drilling into MyCandidatesGroupPage), but that content is retired now --
// this tab took over what used to live on My Interviews instead (the same
// flat, sortable table of every interview this interviewer is on), plus a
// new vacancy filter dropdown on top of it. My Interviews itself became the
// HR-style calendar (see MyInterviewsPage.tsx).
export default function MyCandidatesPage() {
  const [rows, setRows] = useState<MyInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FeedbackFilter>("ALL");
  const [vacancyFilter, setVacancyFilter] = useState<number | "ALL">("ALL");
  const navigate = useNavigate();
  const location = useLocation();

  // The Feedback page navigates back here (not to My Interviews -- that
  // calendar is read-only now) and hands off a one-shot success message via
  // route state, e.g. "Feedback submitted successfully." vs "...updated...".
  // Captured once on mount, then the state is cleared via replace so a
  // browser refresh/back doesn't re-show a stale toast.
  const [toast, setToast] = useState<string | null>(() => (location.state as { toast?: string } | null)?.toast ?? null);

  useEffect(() => {
    if (location.state && (location.state as { toast?: string }).toast) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await listMyInterviews();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your candidates");
    } finally {
      setLoading(false);
    }
  }

  const vacancyOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) map.set(r.application.vacancy.id, r.application.vacancy.title);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // Pending bubbles to the top (still needs action, soonest-scheduled
  // first), submitted sinks to the bottom (already done, most recently
  // commented-on first) -- per the corrections doc.
  const visibleRows = rows
    .filter((r) => {
      if (filter === "SUBMITTED") return r.feedbackSubmitted;
      if (filter === "PENDING") return !r.feedbackSubmitted;
      return true;
    })
    .filter((r) => vacancyFilter === "ALL" || r.application.vacancy.id === vacancyFilter)
    .slice()
    .sort((a, b) => {
      if (a.feedbackSubmitted !== b.feedbackSubmitted) {
        return a.feedbackSubmitted ? 1 : -1;
      }
      if (!a.feedbackSubmitted) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      return new Date(b.feedbackSubmittedAt ?? 0).getTime() - new Date(a.feedbackSubmittedAt ?? 0).getTime();
    });

  return (
    <div className="myc-page">
      <h1 className="myc-title">My Candidates</h1>
      <div className="myc-divider" />

      <div className="myc-toolbar">
        <div className="myc-filter-bar">
          <button className={"myc-filter-btn" + (filter === "ALL" ? " active" : "")} onClick={() => setFilter("ALL")}>
            All
          </button>
          <button className={"myc-filter-btn" + (filter === "SUBMITTED" ? " active" : "")} onClick={() => setFilter("SUBMITTED")}>
            Submitted
          </button>
          <button className={"myc-filter-btn" + (filter === "PENDING" ? " active" : "")} onClick={() => setFilter("PENDING")}>
            Pending
          </button>
        </div>
        <select
          className="myc-vacancy-select"
          value={vacancyFilter}
          onChange={(e) => setVacancyFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
        >
          <option value="ALL">All Vacancies</option>
          {vacancyOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="myc-muted">Loading...</p>}
      {error && <p className="myc-error">{error}</p>}
      {!loading && rows.length === 0 && <p className="myc-muted">No candidates yet - you'll see one here once you're assigned as a panelist on an interview.</p>}
      {!loading && rows.length > 0 && visibleRows.length === 0 && <p className="myc-muted">No candidates match this filter.</p>}

      {!loading && visibleRows.length > 0 && (
        <table className="myc-interviews-table">
          <thead>
            <tr>
              <th className="myc-col-date">Date</th>
              <th className="myc-col-time">Time</th>
              <th className="myc-col-stage">Interview Stage</th>
              <th className="myc-col-position">Position</th>
              <th className="myc-col-candidate">Candidate Name</th>
              <th className="myc-col-feedback">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const dt = new Date(r.scheduledAt);
              return (
                <tr
                  key={r.id}
                  className="myc-interviews-row"
                  onClick={() => navigate(`/interviewer/candidates/${r.id}/feedback`)}
                >
                  <td>{dt.toLocaleDateString()}</td>
                  <td>{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{r.vacancyStage.name}</td>
                  <td>{r.application.vacancy.title}</td>
                  <td>{r.application.candidate.name}</td>
                  <td>
                    <span className={"myc-badge " + (r.feedbackSubmitted ? "myc-badge-done" : "myc-badge-pending")}>
                      {r.feedbackSubmitted ? "Submitted" : "Pending"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {toast && <Toast message={toast} duration={6000} dismissible onClose={() => setToast(null)} />}
    </div>
  );
}
