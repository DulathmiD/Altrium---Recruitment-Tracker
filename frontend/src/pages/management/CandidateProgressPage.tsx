import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCandidateProgress, type CandidateProgressRow } from "../../api/management";
import { listMyInterviews, type MyInterview } from "../../api/interviews";
import Toast from "../../components/Toast";
import "./CandidateProgressPage.css";
import "./MyCandidatesPage.css";

function statusClass(status: CandidateProgressRow["status"]): string {
  if (status === "Ready") return "cp-status cp-status-ready";
  if (status === "Delayed") return "cp-status cp-status-delayed";
  return "cp-status cp-status-progress";
}

type FeedbackFilter = "ALL" | "SUBMITTED" | "PENDING";

// Corrections doc: "combine the my candidate and candidate progression
// pages" -- these used to be two separate nav items/routes with two
// genuinely different datasets (My Candidates = interviews where Management
// personally is a panelist and owes feedback, scoped by listMyInterviews;
// Candidate Progress = a read-only, department-wide oversight table of every
// candidate currently in progress, scoped by getCandidateProgress). Neither
// dataset subsumes the other, so this merges them onto one page as two
// sections rather than picking one -- My Candidates first since it's the
// actionable one, Candidate Progress below it as the broader oversight view.
// The route/heading this page renders at (/management/candidate-progress,
// .cp-section-title) is kept as-is since automated-tests/selenium/sprint2/
// test_management_reports.py navigates there directly and asserts on that
// selector; /management/candidates now redirects here (see App.tsx) instead
// of being removed outright, in case anything else still links to it.
export default function CandidateProgressPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // -- My Candidates section state --
  const [myRows, setMyRows] = useState<MyInterview[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState("");
  const [filter, setFilter] = useState<FeedbackFilter>("ALL");
  const [vacancyFilter, setVacancyFilter] = useState<number | "ALL">("ALL");
  // The Feedback page navigates back here and hands off a one-shot success
  // message via route state (same pattern as interviewer's My Candidates).
  const [toast, setToast] = useState<string | null>(() => (location.state as { toast?: string } | null)?.toast ?? null);

  useEffect(() => {
    if (location.state && (location.state as { toast?: string }).toast) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMyLoading(true);
    setMyError("");
    listMyInterviews()
      .then(setMyRows)
      .catch((err) => setMyError(err instanceof Error ? err.message : "Could not load your candidates"))
      .finally(() => setMyLoading(false));
  }, []);

  const vacancyOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of myRows) map.set(r.application.vacancy.id, r.application.vacancy.title);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [myRows]);

  const visibleMyRows = myRows
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

  // -- Candidate Progress section state --
  const [hasDepartment, setHasDepartment] = useState(true);
  const [progressRows, setProgressRows] = useState<CandidateProgressRow[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    getCandidateProgress()
      .then((res) => {
        if (!res.hasDepartment) {
          setHasDepartment(false);
          return;
        }
        setProgressRows(res.rows);
      })
      .catch((err) => setProgressError(err instanceof Error ? err.message : "Could not load candidate progress"))
      .finally(() => setProgressLoading(false));
  }, []);

  return (
    <div className="cp-page">
      <h1 className="cp-title">Candidates</h1>
      <div className="cp-divider" />

      <h2 className="cp-section-title">My Candidates</h2>
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

      {myLoading && <p className="mgc-muted">Loading...</p>}
      {myError && <p className="mgc-error">{myError}</p>}
      {!myLoading && myRows.length === 0 && (
        <p className="mgc-muted">No candidates yet - you'll see one here once you're assigned as a panelist on an interview.</p>
      )}
      {!myLoading && myRows.length > 0 && visibleMyRows.length === 0 && <p className="mgc-muted">No candidates match this filter.</p>}

      {!myLoading && visibleMyRows.length > 0 && (
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
            {visibleMyRows.map((r) => {
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

      <div className="cp-divider" />

      {!hasDepartment && (
        <p className="cp-muted">No department is set on your account, so there's nothing to scope this to yet -- ask IT Admin to set your department.</p>
      )}
      {progressLoading && <p className="cp-muted">Loading...</p>}
      {progressError && <p className="cp-error">{progressError}</p>}

      {hasDepartment && !progressLoading && (
        <>
          <h2 className="cp-section-title">Candidates In Progress</h2>
          {progressRows.length === 0 ? (
            <p className="cp-muted">No candidates currently in progress.</p>
          ) : (
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Vacancy</th>
                  <th>Current Stage</th>
                  <th>Days at Stage</th>
                  <th>Waiting On</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((r) => (
                  <tr key={r.applicationId}>
                    <td>{r.candidate.name}</td>
                    <td>{r.vacancy.title}</td>
                    <td>{r.currentStage}</td>
                    <td>{r.daysAtStage}</td>
                    <td>{r.waitingOn}</td>
                    <td><span className={statusClass(r.status)}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {toast && <Toast message={toast} duration={6000} dismissible onClose={() => setToast(null)} />}
    </div>
  );
}
