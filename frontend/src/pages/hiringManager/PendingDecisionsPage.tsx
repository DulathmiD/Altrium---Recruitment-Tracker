import { useEffect, useState } from "react";
import { getMyPendingDecisions, type PendingDecision } from "../../api/hiringManager";
import { submitStageRecommendation, recordHiringDecision } from "../../api/applications";
import Toast from "../../components/Toast";
import "./PendingDecisionsPage.css";

export default function PendingDecisionsPage() {
  const [rows, setRows] = useState<PendingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reviewing, setReviewing] = useState<PendingDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [comments, setComments] = useState("");
  // Corrections doc: confirm what actually happened after Proceed/Do Not
  // Proceed/Hire/Reject instead of just closing the modal silently.
  const [outcomeToast, setOutcomeToast] = useState<string | null>(null);

  function closeModal() {
    setReviewing(null);
    setComments("");
  }

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await getMyPendingDecisions();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pending decisions");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvance() {
    if (!reviewing) return;
    setSubmitting(true);
    setActionError("");
    try {
      await submitStageRecommendation(reviewing.applicationId, "ADVANCE", comments);
      setOutcomeToast(`${reviewing.candidate.name} was advanced to the next round.`);
      closeModal();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not advance candidate");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDoNotProgress() {
    if (!reviewing) return;
    setSubmitting(true);
    setActionError("");
    try {
      await submitStageRecommendation(reviewing.applicationId, "DO_NOT_PROGRESS", comments);
      setOutcomeToast(`Recorded - ${reviewing.candidate.name} will not proceed.`);
      closeModal();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record recommendation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHire() {
    if (!reviewing) return;
    setSubmitting(true);
    setActionError("");
    try {
      await recordHiringDecision(reviewing.applicationId, "HIRE", comments);
      setOutcomeToast(`${reviewing.candidate.name} was marked as Hired.`);
      closeModal();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record hiring decision");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!reviewing) return;
    setSubmitting(true);
    setActionError("");
    try {
      await recordHiringDecision(reviewing.applicationId, "REJECT", comments);
      setOutcomeToast(`${reviewing.candidate.name} was marked as Rejected.`);
      closeModal();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record hiring decision");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pd-page">
      <h1 className="pd-title">Pending Decisions</h1>
      <div className="pd-divider" />

      {loading && <p className="pd-muted">Loading...</p>}
      {error && <p className="pd-error">{error}</p>}
      {!loading && rows.length === 0 && <p className="pd-muted">Nothing awaiting your decision right now.</p>}

      {!loading && rows.length > 0 && (
        <table className="pd-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Vacancy</th>
              <th>Numeric Score</th>
              <th>Comments</th>
              <th>Waiting Since</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.applicationId}>
                <td>{r.candidate.name}</td>
                <td>{r.vacancy.title}</td>
                <td>{r.score ?? "--"}</td>
                <td>{r.commentsAvailable ? "Available" : "--"}</td>
                <td>{new Date(r.waitingSince).toLocaleDateString()}</td>
                <td>
                  <button className="pd-review-btn" onClick={() => setReviewing(r)}>Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reviewing && (
        <div className="pd-modal-backdrop" onClick={closeModal}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{reviewing.candidate.name}</h2>
            <p className="pd-muted">
              {reviewing.vacancy.title} &middot; Round {reviewing.round.order}: {reviewing.round.name}
              {reviewing.isFinalRound ? " (Final Round)" : ""}
            </p>

            <div className="pd-score-row">
              <span className="pd-score-label">Numeric Score</span>
              <span className="pd-score-value">{reviewing.score ?? "--"}</span>
            </div>

            <label>Interview Feedback (all rounds)</label>
            {reviewing.feedbackHistory.length === 0 && <p className="pd-muted">No feedback recorded yet.</p>}
            <div className="pd-feedback-history">
              {reviewing.feedbackHistory.map((round) => (
                <div key={round.round.id} className="pd-feedback-round">
                  <p className="pd-feedback-round-title">Round {round.round.order}: {round.round.name}</p>
                  {round.entries.map((entry) => (
                    <div key={entry.interviewerId} className="pd-feedback-entry">
                      <div className="pd-feedback-entry-head">
                        <span className="pd-feedback-interviewer">{entry.interviewerName}</span>
                        <span className="pd-feedback-score">{entry.score}/10</span>
                      </div>
                      <p className="pd-comment">{entry.comments}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <label htmlFor="pd-comments">Add Comments</label>
            <textarea
              id="pd-comments"
              className="pd-comments-input"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional notes about this decision..."
            />

            {actionError && <p className="pd-error">{actionError}</p>}

            <div className="pd-modal-actions">
              <button className="pd-cancel-btn" onClick={closeModal}>Cancel</button>
              {reviewing.isFinalRound ? (
                <>
                  <button className="pd-action-btn pd-action-negative" onClick={handleReject} disabled={submitting}>
                    Reject
                  </button>
                  <button className="pd-action-btn pd-action-positive" onClick={handleHire} disabled={submitting}>
                    Hire
                  </button>
                </>
              ) : (
                <>
                  <button className="pd-action-btn pd-action-negative" onClick={handleDoNotProgress} disabled={submitting}>
                    Do Not Proceed
                  </button>
                  <button className="pd-action-btn pd-action-positive" onClick={handleAdvance} disabled={submitting}>
                    Proceed
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {outcomeToast && <Toast message={outcomeToast} duration={6000} dismissible onClose={() => setOutcomeToast(null)} />}
    </div>
  );
}
