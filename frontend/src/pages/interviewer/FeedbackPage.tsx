import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { getInterview, type InterviewDetail } from "../../api/interviews";
import { getMyFeedbackForInterview, submitFeedback, updateFeedback, type Feedback } from "../../api/feedback";
import "./FeedbackPage.css";

// Shared by Interviewer's and Management's My Candidates tabs (corrections
// doc: both assignable-panelist roles need the same click-a-candidate-to-
// add-feedback flow) -- every API call here already scopes by req.user.id
// server-side regardless of role, so the only role-specific thing is where
// "back" goes.
//
// The Hiring Manager used to have a third entry point here (a "My
// Interviews" tab), removed per a later correction: the HM isn't an
// interviewer/panelist -- their role is deciding Proceed/Do Not
// Proceed/Hire/Reject from Pending Decisions, not sitting on panels. See
// HMLayout.tsx/App.tsx for the matching nav/route removal.
export default function FeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const interviewId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  // Follow-up correction: feedback entry only ever opens from the panelist's
  // own tab now (Interviewer's My Interviews calendar rows are read-only),
  // for every role that has this page -- "back" and its label both depend
  // on which one. Each layout's own NavLink prefix-match then highlights the
  // right nav item, since every role's feedback URL lives under its own
  // tab's own path prefix.
  const isManagement = location.pathname.startsWith("/management");
  const backTo = isManagement ? "/management/candidates" : "/interviewer/candidates";
  const backLabel = "My Candidates";

  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [existing, setExisting] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [score, setScore] = useState("");
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isEditMode = existing !== null;

  useEffect(() => {
    if (Number.isNaN(interviewId)) return;
    load();
  }, [interviewId]);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [iv, fb] = await Promise.all([
        getInterview(interviewId),
        getMyFeedbackForInterview(interviewId),
      ]);
      setInterview(iv);
      // Scoped to "my own" server-side -- at most one entry can come back
      // (Feedback has a unique [interviewId, interviewerId] constraint).
      const mine = fb[0] ?? null;
      setExisting(mine);
      setScore(mine ? String(mine.score) : "");
      setComments(mine ? mine.comments : "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load this interview");
    } finally {
      setLoading(false);
    }
  }

  function validate(): string | null {
    const n = Number(score);
    if (!score || !Number.isInteger(n) || n < 1 || n > 10) {
      return "Score must be a whole number from 1 to 10";
    }
    if (!comments.trim()) {
      return "Comments are required";
    }
    if (isEditMode && !reason.trim()) {
      return "A reason for the change is required";
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const n = Number(score);
      // Capture before navigating away -- per follow-up correction, a
      // successful submit leaves this page entirely (back to My Candidates)
      // with a one-shot toast there, rather than staying here with an inline
      // "Feedback saved." message. Wording differs for create vs edit so a
      // re-edit (isEditMode was already true on entry) reads as "updated",
      // not a duplicate "submitted".
      if (isEditMode && existing) {
        await updateFeedback(existing.id, { score: n, comments, reason: reason.trim() });
        navigate(backTo, { state: { toast: "Feedback updated successfully." } });
      } else {
        await submitFeedback(interviewId, { score: n, comments });
        navigate(backTo, { state: { toast: "Feedback submitted successfully." } });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save feedback");
      setSaving(false);
    }
  }

  const isFuture = interview ? new Date(interview.scheduledAt) > new Date() : false;

  return (
    <div className="fb-page">
      <p className="fb-breadcrumb">
        <Link to={backTo}>{backLabel}</Link>
        {" / "}
        {interview ? interview.application.candidate.name : "..."}
        {" / "}
        Feedback
      </p>
      <div className="fb-divider" />

      {loading && <p className="fb-muted">Loading...</p>}
      {loadError && <p className="fb-error">{loadError}</p>}

      {!loading && interview && (
        <div className="fb-layout">
          <div className="fb-form-col">
            {isFuture && (
              <p className="fb-warning">
                This interview hasn't taken place yet - feedback can only be submitted afterward.
              </p>
            )}

            <label className="fb-label" htmlFor="fb-score">Score (1-10)</label>
            <input
              id="fb-score"
              className="fb-score-input"
              type="number"
              min={1}
              max={10}
              step={1}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              disabled={isFuture}
            />

            <label className="fb-label" htmlFor="fb-comments">Comments</label>
            <textarea
              id="fb-comments"
              className="fb-comments-input"
              rows={12}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={isFuture}
            />

            {isEditMode && (
              <>
                <label className="fb-label" htmlFor="fb-reason">Reason for change</label>
                <input
                  id="fb-reason"
                  className="fb-reason-input"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you editing this feedback?"
                  disabled={isFuture}
                />
              </>
            )}

            {saveError && <p className="fb-error">{saveError}</p>}

            <div className="fb-actions">
              <button className="fb-cancel-btn" onClick={() => navigate(backTo)}>
                Back
              </button>
              <button className="fb-submit-btn" onClick={handleSubmit} disabled={saving || isFuture}>
                {isEditMode ? "Save Changes" : "Submit"}
              </button>
            </div>
          </div>

          <aside className="fb-info-card">
            <div className="fb-info-title">Interview Details</div>
            <div className="fb-info-row">
              <span className="fb-info-label">Candidate</span>
              <span className="fb-info-value">{interview.application.candidate.name}</span>
            </div>
            <div className="fb-info-row">
              <span className="fb-info-label">Vacancy</span>
              <span className="fb-info-value">{interview.application.vacancy.title}</span>
            </div>
            <div className="fb-info-row">
              <span className="fb-info-label">Stage</span>
              <span className="fb-info-value">{interview.vacancyStage.name}</span>
            </div>
            <div className="fb-info-row">
              <span className="fb-info-label">Scheduled</span>
              <span className="fb-info-value">{new Date(interview.scheduledAt).toLocaleString()}</span>
            </div>
            {interview.panelists.length > 0 && (
              <div className="fb-info-row fb-info-row-block">
                <span className="fb-info-label">Panel</span>
                <ul className="fb-panel-list">
                  {interview.panelists.map((p) => (
                    <li key={p.id}>{p.user.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
