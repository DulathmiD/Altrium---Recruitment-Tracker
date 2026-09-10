import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getApplicationDecision, type ApplicationDecision } from "../../api/hiringManager";
import { submitStageRecommendation, recordHiringDecision } from "../../api/applications";
import { getFeedbackAuditLog, type FeedbackAuditLogEntry } from "../../api/feedback";
import "./CandidateDecisionPage.css";

export default function CandidateDecisionPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const id = Number(applicationId);
  const navigate = useNavigate();

  const [data, setData] = useState<ApplicationDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  // Corrections doc: clicking Proceed/Do Not Proceed/Hire/Reject used to
  // submit and silently navigate(-1) with no confirmation of what actually
  // happened to the candidate -- this holds the outcome text on-page instead
  // of leaving immediately, so the HM sees it before moving on.
  const [outcome, setOutcome] = useState<string | null>(null);

  // Feedback edit history: previously captured (FeedbackAuditLog) but never
  // shown anywhere -- clicking "Edited" on a feedback entry now expands its
  // full before/after/reason trail in place, fetched on demand rather than
  // upfront since most entries were never edited.
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<number, FeedbackAuditLogEntry[]>>({});
  const [auditLoading, setAuditLoading] = useState<number | null>(null);
  const [auditError, setAuditError] = useState("");

  async function toggleAuditLog(feedbackId: number) {
    if (expandedFeedbackId === feedbackId) {
      setExpandedFeedbackId(null);
      return;
    }
    setExpandedFeedbackId(feedbackId);
    if (auditLogs[feedbackId]) return; // already fetched
    setAuditLoading(feedbackId);
    setAuditError("");
    try {
      const log = await getFeedbackAuditLog(feedbackId);
      setAuditLogs((prev) => ({ ...prev, [feedbackId]: log }));
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Could not load edit history");
    } finally {
      setAuditLoading(null);
    }
  }

  useEffect(() => {
    if (Number.isNaN(id)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getApplicationDecision(id);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this candidate");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvance() {
    setSubmitting(true);
    setActionError("");
    try {
      await submitStageRecommendation(id, "ADVANCE", comments);
      setOutcome(`${data?.candidate.name ?? "Candidate"} was advanced to the next round.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not advance candidate");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDoNotProgress() {
    setSubmitting(true);
    setActionError("");
    try {
      await submitStageRecommendation(id, "DO_NOT_PROGRESS", comments);
      setOutcome(`Recorded - ${data?.candidate.name ?? "this candidate"} will not proceed.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record recommendation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHire() {
    setSubmitting(true);
    setActionError("");
    try {
      await recordHiringDecision(id, "HIRE", comments);
      setOutcome(`${data?.candidate.name ?? "Candidate"} was marked as Hired.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record hiring decision");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    setActionError("");
    try {
      await recordHiringDecision(id, "REJECT", comments);
      setOutcome(`${data?.candidate.name ?? "Candidate"} was marked as Rejected.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record hiring decision");
    } finally {
      setSubmitting(false);
    }
  }

  function backToCandidates() {
    if (data) navigate(`/hiring-manager/vacancies/${data.vacancy.id}/candidates`);
    else navigate(-1);
  }

  return (
    <div className="cd-page">
      <p className="cd-breadcrumb">
        <Link to="/hiring-manager/vacancies">Vacancies</Link>
        {" / "}
        {data ? <Link to={`/hiring-manager/vacancies/${data.vacancy.id}/candidates`}>Candidates</Link> : "Candidates"}
        {" / "}
        {data ? data.candidate.name : "..."}
      </p>
      <h1 className="cd-title">{data ? `Panel Feedback - ${data.candidate.name}` : "Panel Feedback"}</h1>
      <div className="cd-divider" />

      {loading && <p className="cd-muted">Loading...</p>}
      {error && <p className="cd-error">{error}</p>}

      {!loading && data && outcome && (
        <div className="cd-outcome-panel">
          <p className="cd-outcome cd-outcome-hired">{outcome}</p>
          <div className="cd-actions">
            <button className="cd-action-btn cd-action-positive" onClick={backToCandidates}>
              Back to Candidates
            </button>
          </div>
        </div>
      )}

      {!loading && data && !outcome && (
        <>
          {(data.stage === "HIRED" || data.stage === "REJECTED") && (
            <p className={data.stage === "HIRED" ? "cd-outcome cd-outcome-hired" : "cd-outcome cd-outcome-rejected"}>
              This candidate has already been {data.stage === "HIRED" ? "hired" : "rejected"}.
            </p>
          )}
          {data.stage === "SHORTLISTED" && !data.awaitingDecision && (
            <p className="cd-warning">
              {data.round ? `Waiting on the panel's feedback for ${data.round.name} before a decision can be made.` : "This candidate hasn't entered an interview round yet."}
            </p>
          )}
          {data.stage === "APPLIED" && (
            <p className="cd-warning">This candidate hasn't been shortlisted yet.</p>
          )}

          {/* Corrections doc: removed the "No panel feedback recorded yet."
              fallback -- now that hired/rejected candidates are always
              seeded with the real feedback that led to their decision (see
              seed-full-demo.ts archetypes 6/7), this only fires for a
              genuinely no-feedback-yet mid-round candidate, and the warning
              banner above already covers that case on its own. */}

          {data.feedbackHistory.map((round) => (
            <div key={round.round.id} className="cd-stage-block">
              <h2 className="cd-stage-title">Stage {String(round.round.order).padStart(2, "0")}: {round.round.name}</h2>
              <div className="cd-entry-list">
                {round.entries.map((entry) => (
                  <div key={entry.feedbackId} className="cd-entry-card">
                    <p><strong>Interviewer Name:</strong> {entry.interviewerName}</p>
                    <p><strong>Interview Score:</strong> {entry.score}</p>
                    <p><strong>Feedback:</strong> {entry.comments}</p>
                    {entry.edited && (
                      <>
                        <button
                          type="button"
                          className="cd-edited-toggle"
                          onClick={() => toggleAuditLog(entry.feedbackId)}
                        >
                          {expandedFeedbackId === entry.feedbackId ? "Hide edit history" : "Edited - view history"}
                        </button>
                        {expandedFeedbackId === entry.feedbackId && (
                          <div className="cd-audit-log">
                            {auditLoading === entry.feedbackId && <p className="cd-muted">Loading...</p>}
                            {auditError && <p className="cd-error">{auditError}</p>}
                            {auditLogs[entry.feedbackId]?.map((log) => (
                              <div key={log.id} className="cd-audit-entry">
                                <p className="cd-audit-meta">
                                  Edited by {log.editedBy.name} on {new Date(log.editedAt).toLocaleString()}
                                </p>
                                <p><strong>Reason:</strong> {log.reason}</p>
                                <p>
                                  <strong>Score:</strong> {log.previousScore} &rarr; {log.newScore}
                                </p>
                                <p>
                                  <strong>Comments:</strong> "{log.previousComments}" &rarr; "{log.newComments}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {data.awaitingDecision && (
            <>
              <label className="cd-label" htmlFor="cd-comments">Add Comments</label>
              <textarea
                id="cd-comments"
                className="cd-comments-input"
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Optional notes about this decision..."
              />

              {actionError && <p className="cd-error">{actionError}</p>}

              <div className="cd-actions">
                <button className="cd-cancel-btn" onClick={() => navigate(-1)}>Back</button>
                {data.isFinalRound ? (
                  <>
                    <button className="cd-action-btn cd-action-negative" onClick={handleReject} disabled={submitting}>Reject</button>
                    <button className="cd-action-btn cd-action-positive" onClick={handleHire} disabled={submitting}>Hire</button>
                  </>
                ) : (
                  <>
                    <button className="cd-action-btn cd-action-negative" onClick={handleDoNotProgress} disabled={submitting}>Do Not Proceed</button>
                    <button className="cd-action-btn cd-action-positive" onClick={handleAdvance} disabled={submitting}>Proceed</button>
                  </>
                )}
              </div>
            </>
          )}

          {!data.awaitingDecision && (
            <div className="cd-actions">
              <button className="cd-cancel-btn" onClick={() => navigate(-1)}>Back</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
