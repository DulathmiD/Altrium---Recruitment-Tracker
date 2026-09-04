// SUPERSEDED (corrections doc: "combine the my candidate and candidate
// progression pages") -- this page's content now lives as a section inside
// CandidateProgressPage.tsx, reached via the single "Candidates" nav item.
// No longer imported/routed anywhere (App.tsx redirects the old
// /management/candidates path there); left in place, unused, for reference.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listMyInterviews, type MyInterview } from "../../api/interviews";
import Toast from "../../components/Toast";
import "./MyCandidatesPage.css";

type FeedbackFilter = "ALL" | "SUBMITTED" | "PENDING";

// Corrections doc: Management gets a new "My Candidates" tab built the same
// way as Interviewer's (locked answer: flat list + vacancy filter, see
// interviewer/MyCandidatesPage.tsx) -- candidates are clickable so Management
// can add feedback, since they attend the final interview round.
// listMyInterviews is role-agnostic server-side (scoped by panelist
// membership, not role), so this reuses it exactly as-is.
export default function MyCandidatesPage() {
  const [rows, setRows] = useState<MyInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FeedbackFilter>("ALL");
  const [vacancyFilter, setVacancyFilter] = useState<number | "ALL">("ALL");
  const navigate = useNavigate();
  const location = useLocation();

  // The Feedback page navigates back here and hands off a one-shot success
  // message via route state (same pattern as interviewer/MyCandidatesPage.tsx).
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
    <div className="mgc-page">
      <h1 className="mgc-title">My Candidates</h1>
      <div className="mgc-divider" />

      <div className="mgc-toolbar">
        <div className="mgc-filter-bar">
          <button className={"mgc-filter-btn" + (filter === "ALL" ? " active" : "")} onClick={() => setFilter("ALL")}>
            All
          </button>
          <button className={"mgc-filter-btn" + (filter === "SUBMITTED" ? " active" : "")} onClick={() => setFilter("SUBMITTED")}>
            Submitted
          </button>
          <button className={"mgc-filter-btn" + (filter === "PENDING" ? " active" : "")} onClick={() => setFilter("PENDING")}>
            Pending
          </button>
        </div>
        <select
          className="mgc-vacancy-select"
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

      {loading && <p className="mgc-muted">Loading...</p>}
      {error && <p className="mgc-error">{error}</p>}
      {!loading && rows.length === 0 && <p className="mgc-muted">No candidates yet - you'll see one here once you're assigned as a panelist on an interview.</p>}
      {!loading && rows.length > 0 && visibleRows.length === 0 && <p className="mgc-muted">No candidates match this filter.</p>}

      {!loading && visibleRows.length > 0 && (
        <table className="mgc-interviews-table">
          <thead>
            <tr>
              <th className="mgc-col-date">Date</th>
              <th className="mgc-col-time">Time</th>
              <th className="mgc-col-stage">Interview Stage</th>
              <th className="mgc-col-position">Position</th>
              <th className="mgc-col-candidate">Candidate Name</th>
              <th className="mgc-col-feedback">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const dt = new Date(r.scheduledAt);
              return (
                <tr
                  key={r.id}
                  className="mgc-interviews-row"
                  onClick={() => navigate(`/management/candidates/${r.id}/feedback`)}
                >
                  <td>{dt.toLocaleDateString()}</td>
                  <td>{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{r.vacancyStage.name}</td>
                  <td>{r.application.vacancy.title}</td>
                  <td>{r.application.candidate.name}</td>
                  <td>
                    <span className={"mgc-badge " + (r.feedbackSubmitted ? "mgc-badge-done" : "mgc-badge-pending")}>
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
