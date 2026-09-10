import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  listCandidates,
  getCandidateDetail,
  saveCandidateReviewNote,
  markCandidateReviewed,
  fetchCvBlobUrl,
  type CandidateApplicationRow,
  type CandidateDetail,
  type RecruitmentStage,
} from "../../api/candidates";
import { updateApplicationStatus, assignHiringManager } from "../../api/applications";
import { listAssignableStaff, type StaffMember } from "../../api/staff";
import { listInterviewsForApplication, type Interview } from "../../api/interviews";
import { stageDisplayFor } from "../../utils/candidateStage";
import "./CandidatesPage.css";

// Frontend-corrections pass: candidate detail moved from a modal to its own
// routed page ("/hr/candidates/:applicationId") per user feedback, with
// sections reordered: CV Preview first, then Review Notes, Applicant
// History, Hiring Manager, Interviews, Schedule Interview, and finally the
// Reject/Shortlist decision row. Restyled as solid pill buttons matching the
// Hiring Manager's Reject/Hire buttons on Pending Decisions. Placement went
// through three rounds: bottom-of-page (original) -> top-right of the header
// -> position: fixed bottom-right of the viewport -> back to bottom-of-page,
// per explicit user correction ("not floating, just put it at the end of the
// screen once they scroll down") -- lands back where it started, just with
// the new solid-pill styling instead of the original thin outline.
// There's no single "get one application, shaped like the list row" backend
// endpoint, so this re-fetches the full candidates list and finds the
// matching row by id -- fine at this app's data scale, and keeps the row's
// shape identical to what the list already uses instead of reconciling it
// against a differently-shaped single-application endpoint.

const STAGE_LABELS: Record<RecruitmentStage, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export default function CandidateDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const id = Number(applicationId);

  const [row, setRow] = useState<CandidateApplicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [detailInterviews, setDetailInterviews] = useState<Interview[]>([]);
  const [detailError, setDetailError] = useState("");

  const [hmOptions, setHmOptions] = useState<StaffMember[]>([]);
  const [hmSelection, setHmSelection] = useState<number | "">("");
  const [hmSaving, setHmSaving] = useState(false);
  const [hmError, setHmError] = useState("");

  const [candidateDetail, setCandidateDetail] = useState<CandidateDetail | null>(null);
  // Email History rows are collapsed by default (subject/body can be long) --
  // clicking a row toggles it open instead of navigating anywhere.
  const [expandedEmailId, setExpandedEmailId] = useState<number | null>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(true);
  const [reviewNoteDraft, setReviewNoteDraft] = useState("");
  const [reviewNoteSaving, setReviewNoteSaving] = useState(false);
  const [reviewNoteError, setReviewNoteError] = useState("");
  const [cvViewBusy, setCvViewBusy] = useState(false);
  const [cvViewError, setCvViewError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    listAssignableStaff("HIRING_MANAGER").then(setHmOptions).catch(() => {});
    listCandidates({})
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find((r) => r.id === id);
        if (!found) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRow(found);
        setHmSelection(found.hiringManagerId ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    setDetailError("");
    listInterviewsForApplication(row.id)
      .then((interviews) => {
        if (cancelled) return;
        setDetailInterviews(interviews);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : "Could not load application details");
      });

    setCandidateDetailLoading(true);
    getCandidateDetail(row.candidateId)
      .then((detail) => {
        if (cancelled) return;
        setCandidateDetail(detail);
        setReviewNoteDraft(detail.lastCvReviewNote ?? "");
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError((prev) => prev || (err instanceof Error ? err.message : "Could not load candidate detail"));
        }
      })
      .finally(() => {
        if (!cancelled) setCandidateDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  async function handleReject() {
    if (!row) return;
    setActionBusy(true);
    setActionError("");
    try {
      await updateApplicationStatus(row.id, "REJECTED");
      navigate("/hr/candidates", { state: { toast: `${row.candidate.name} was rejected.` } });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reject candidate");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleShortlist() {
    if (!row) return;
    setActionBusy(true);
    setActionError("");
    try {
      await updateApplicationStatus(row.id, "SHORTLISTED");
      navigate("/hr/candidates", { state: { toast: `${row.candidate.name} was shortlisted.` } });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not shortlist candidate");
    } finally {
      setActionBusy(false);
    }
  }

  // The one path back from an early CV-screening rejection -- HR rejected
  // the CV before it was ever shortlisted, and there's currently no way to
  // reapply (a second application for the same candidate+vacancy is blocked
  // outright, see the 409 duplicate handling on the Candidates list upload
  // flow) or otherwise reconsider them. Only offered when hiringDecision is
  // null (see the CandidateApplicationRow comment) -- a REJECTED application
  // that came out of a real post-interview hiring decision is a final
  // outcome, not reopened here.
  async function handleReconsider() {
    if (!row) return;
    setActionBusy(true);
    setActionError("");
    try {
      await updateApplicationStatus(row.id, "SHORTLISTED");
      navigate("/hr/candidates", {
        state: { toast: `${row.candidate.name} was reconsidered and moved back to Shortlisted.` },
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reconsider candidate");
    } finally {
      setActionBusy(false);
    }
  }

  // Opens the CV in a new tab and, in the same click, marks the candidate
  // as reviewed. Deliberately two calls fired together rather than folding
  // the stamp into downloadCv() itself -- that route is shared with the
  // Candidates list's standalone "View" link, which should stay a plain
  // fetch with no side effect (see markCvReviewed's comment on the backend).
  async function handleViewCv() {
    if (!candidateDetail) return;
    setCvViewBusy(true);
    setCvViewError("");
    try {
      const url = await fetchCvBlobUrl(candidateDetail.id);
      window.open(url, "_blank");
      const updated = await markCandidateReviewed(candidateDetail.id);
      setCandidateDetail((prev) =>
        prev
          ? { ...prev, lastCvReviewedByUserId: updated.lastCvReviewedByUserId, lastCvReviewedAt: updated.lastCvReviewedAt, lastCvReviewedBy: updated.lastCvReviewedBy }
          : prev
      );
    } catch (err) {
      setCvViewError(err instanceof Error ? err.message : "Could not load CV");
    } finally {
      setCvViewBusy(false);
    }
  }

  async function handleSaveReviewNote() {
    if (!candidateDetail) return;
    setReviewNoteSaving(true);
    setReviewNoteError("");
    try {
      const updated = await saveCandidateReviewNote(candidateDetail.id, reviewNoteDraft.trim());
      setCandidateDetail((prev) => (prev ? { ...prev, lastCvReviewNote: updated.lastCvReviewNote } : prev));
    } catch (err) {
      setReviewNoteError(err instanceof Error ? err.message : "Could not save review note");
    } finally {
      setReviewNoteSaving(false);
    }
  }

  async function handleAssignHm() {
    if (!row || !hmSelection) return;
    setHmSaving(true);
    setHmError("");
    try {
      await assignHiringManager(row.id, hmSelection);
      const hm = hmOptions.find((h) => h.id === hmSelection);
      setRow((prev) =>
        prev ? { ...prev, hiringManagerId: hmSelection || null, hiringManager: hm ?? prev.hiringManager } : prev
      );
    } catch (err) {
      setHmError(err instanceof Error ? err.message : "Could not assign hiring manager");
    } finally {
      setHmSaving(false);
    }
  }

  // Split by scheduledAt vs now -- there's no separate "completed" flag on
  // an Interview, a past-dated one just means it already happened.
  const upcomingInterviews = useMemo(
    () => detailInterviews.filter((iv) => new Date(iv.scheduledAt).getTime() > Date.now()),
    [detailInterviews]
  );
  const completedInterviews = useMemo(
    () => detailInterviews.filter((iv) => new Date(iv.scheduledAt).getTime() <= Date.now()),
    [detailInterviews]
  );

  if (loading) {
    return (
      <div className="cnd-page cnd-detail-page">
        <p className="cnd-muted">Loading...</p>
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="cnd-page cnd-detail-page">
        <p className="cnd-error">Application not found.</p>
        <Link to="/hr/candidates" className="cnd-back-link">
          &#8592; Back to Candidates
        </Link>
      </div>
    );
  }

  // A final hiring decision (HIRE or REJECT via recordHiringDecision) is a
  // done deal for THIS application -- there's nothing left to review or
  // reassign here. Deliberately narrower than `stage === "REJECTED"` alone:
  // an early CV-screening rejection leaves hiringDecision null and stays
  // fully editable/reconsiderable (see handleReconsider above), same
  // distinction the Reconsider row below already relies on.
  // Note this only locks the view for *this* application -- Review Notes
  // lives on the Candidate record, not the application, so if this person
  // has another still-open application, the same note stays editable from
  // there.
  const isFinalDecision = row.hiringDecision !== null;

  // Review Notes lock separately from isFinalDecision, and earlier --
  // correction: the note is literally the reason HR shortlisted or rejected
  // at CV-review time, not a running note that stays open through the whole
  // interview process, so it should stop being editable the moment that CV
  // decision is made (row.stage leaves APPLIED), not only once a much later
  // final HIRE/REJECT decision lands. Still per-application like above (a
  // CV-stage REJECTED here doesn't lock the same candidate's note on a
  // different, still-APPLIED application), and Reconsider (which sets this
  // application's stage back to SHORTLISTED, never back to APPLIED) doesn't
  // reopen it either -- once a CV decision has been made once, it stays
  // locked, consistent with "this is what was decided and why" rather than
  // an editable-forever field.
  const isCvReviewLocked = row.stage !== "APPLIED";

  // ON_HOLD freeze: mirrors the backend's assertVacancyNotOnHold checks
  // (application.controller.ts) -- while the vacancy is on hold, this
  // candidate can't be shortlisted/rejected/reconsidered, and can't get a
  // Hiring Manager assigned. This is purely a UI-level mirror of an already
  // server-enforced rule, not the source of truth -- a direct API call would
  // still be blocked even if this check were removed.
  const isVacancyOnHold = row.vacancy.status === "ON_HOLD";

  return (
    <div className="cnd-page cnd-detail-page">
      <Link to="/hr/candidates" className="cnd-back-link">
        &#8592; Back to Candidates
      </Link>
      <h1 className="cnd-title">{row.candidate.name}</h1>
      <p className="cnd-muted">
        {row.vacancy.title} - {row.vacancy.department} &middot; {STAGE_LABELS[row.stage]}
      </p>
      <div className="cnd-divider" />

      {isVacancyOnHold && (
        <p className="cnd-muted cnd-locked-hint">
          This vacancy is on hold -- this candidate can't be shortlisted, rejected, or progressed until it's reopened.
        </p>
      )}
      {detailError && <p className="cnd-error">{detailError}</p>}
      {actionError && <p className="cnd-error">{actionError}</p>}

      <div className="cnd-detail-section">
        <label>CV</label>
        <div className="cnd-inline-row">
          <button
            type="button"
            className="cnd-save-btn"
            onClick={handleViewCv}
            disabled={cvViewBusy || candidateDetailLoading}
          >
            {cvViewBusy ? "Opening..." : "View CV"}
          </button>
        </div>
        {cvViewError && <p className="cnd-error">{cvViewError}</p>}
      </div>

      <div className="cnd-detail-section">
        <label htmlFor="cnd-review-note">Review Notes</label>
        <p className="cnd-muted">
          Last Reviewed By: {candidateDetail?.lastCvReviewedBy ? candidateDetail.lastCvReviewedBy.name : "Not yet reviewed"}
          {candidateDetail?.lastCvReviewedAt && ` on ${new Date(candidateDetail.lastCvReviewedAt).toLocaleDateString()}`}
        </p>
        {isCvReviewLocked ? (
          <p className="cnd-review-note-locked">
            {candidateDetail?.lastCvReviewNote || "No notes were left."}
          </p>
        ) : (
          <>
            <textarea
              id="cnd-review-note"
              className="cnd-review-note-input"
              rows={3}
              placeholder="Notes on this candidate's CV..."
              value={reviewNoteDraft}
              onChange={(e) => setReviewNoteDraft(e.target.value)}
              disabled={candidateDetailLoading}
            />
            <div className="cnd-inline-row">
              <button
                type="button"
                className="cnd-save-btn"
                onClick={handleSaveReviewNote}
                disabled={reviewNoteSaving || candidateDetailLoading || !candidateDetail}
              >
                {reviewNoteSaving ? "Saving..." : "Save Note"}
              </button>
            </div>
            {reviewNoteError && <p className="cnd-error">{reviewNoteError}</p>}
          </>
        )}
      </div>

      <div className="cnd-detail-section">
        <label>Applicant History</label>
        {candidateDetailLoading && <p className="cnd-muted">Loading...</p>}
        {!candidateDetailLoading && candidateDetail && candidateDetail.applications.length <= 1 && (
          <p className="cnd-muted">No other applications from this candidate.</p>
        )}
        <div className="cnd-review-list">
          {candidateDetail?.applications
            .filter((a) => a.id !== row.id)
            .map((a) => {
              const stage = stageDisplayFor(a);
              return (
                <div key={a.id} className="cnd-summary-row">
                  <span className="cnd-summary-name">
                    {a.vacancy.title} - {a.vacancy.department}
                  </span>
                  <span className={stage.rejected ? "cnd-stage-rejected" : "cnd-muted"}>
                    {stage.text ? `${stage.text} · ` : ""}
                    {new Date(a.appliedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      <div className="cnd-detail-section">
        <label>Email History</label>
        {candidateDetailLoading && <p className="cnd-muted">Loading...</p>}
        {!candidateDetailLoading && candidateDetail && candidateDetail.emailHistory.length === 0 && (
          <p className="cnd-muted">No emails sent to this candidate yet.</p>
        )}
        <div className="cnd-review-list">
          {candidateDetail?.emailHistory.map((e) => {
            const expanded = expandedEmailId === e.id;
            return (
              <div key={e.id} className="cnd-email-history-item">
                <button
                  type="button"
                  className="cnd-summary-row cnd-email-history-toggle"
                  onClick={() => setExpandedEmailId(expanded ? null : e.id)}
                  aria-expanded={expanded}
                >
                  <span className="cnd-summary-name">{e.label}</span>
                  <span className="cnd-muted">Sent &middot; {new Date(e.sentAt).toLocaleString()}</span>
                </button>
                {expanded && (
                  <div className="cnd-email-history-body">
                    {e.body ? (
                      <>
                        <p className="cnd-email-history-subject">{e.subject}</p>
                        <p className="cnd-email-history-text">{e.body}</p>
                      </>
                    ) : (
                      <p className="cnd-muted">Content not available for this email.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cnd-detail-section">
        <label>Hiring Manager</label>
        <p className="cnd-muted">Currently: {row.hiringManager ? row.hiringManager.name : "Unassigned"}</p>
        {isFinalDecision ? (
          <p className="cnd-muted cnd-locked-hint">
            This application already has a final hiring decision, so the Hiring Manager can't be changed here.
          </p>
        ) : row.stage === "APPLIED" ? (
          <p className="cnd-muted cnd-locked-hint">
            This candidate hasn't been shortlisted yet -- shortlist them first before assigning a Hiring Manager.
          </p>
        ) : row.stage === "REJECTED" ? (
          <p className="cnd-muted cnd-locked-hint">
            This application was rejected at CV review, so a Hiring Manager can't be assigned.
          </p>
        ) : isVacancyOnHold ? (
          <p className="cnd-muted cnd-locked-hint">
            This vacancy is on hold, so a Hiring Manager can't be assigned until it's reopened.
          </p>
        ) : (
          <>
            <div className="cnd-inline-row">
              <select value={hmSelection} onChange={(e) => setHmSelection(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select a hiring manager</option>
                {hmOptions.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="cnd-save-btn"
                onClick={handleAssignHm}
                disabled={hmSaving || !hmSelection}
              >
                {hmSaving ? "Saving..." : "Assign"}
              </button>
            </div>
            {hmError && <p className="cnd-error">{hmError}</p>}
          </>
        )}
      </div>

      {/* Interviews are scheduled from the main HR Interviews page (Assign
          Panel -> Schedule Interview -> Add Candidate(s) to Interview), not
          from here -- this page used to also have its own one-off "Schedule
          Interview" form, but it duplicated that flow with a separate,
          older per-person panel picker (one that didn't reflect named,
          reusable Panels or the Hiring-Manager-excluded eligibility rule).
          Read-only here instead: upcoming interviews so HR can see what's
          coming up for this candidate, and completed ones as a record of
          what's already happened as they move further into the stages. */}
      <div className="cnd-detail-section">
        <label>Upcoming Interviews</label>
        {upcomingInterviews.length === 0 && <p className="cnd-muted">No interviews scheduled yet.</p>}
        <div className="cnd-review-list">
          {upcomingInterviews.map((iv) => (
            <div key={iv.id} className="cnd-summary-row">
              <span className="cnd-summary-name">
                {iv.vacancyStage.order}. {iv.vacancyStage.name} - {new Date(iv.scheduledAt).toLocaleString()}
              </span>
              <span className="cnd-muted">{iv.panelists.map((p) => p.user.name).join(", ")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cnd-detail-section">
        <label>Completed Interviews</label>
        {completedInterviews.length === 0 && <p className="cnd-muted">No interviews completed yet.</p>}
        <div className="cnd-review-list">
          {completedInterviews.map((iv) => (
            <div key={iv.id} className="cnd-summary-row">
              <span className="cnd-summary-name">
                {iv.vacancyStage.order}. {iv.vacancyStage.name} - {new Date(iv.scheduledAt).toLocaleString()}
              </span>
              <span className="cnd-muted">{iv.panelists.map((p) => p.user.name).join(", ")}</span>
            </div>
          ))}
        </div>
      </div>

      {row.stage === "APPLIED" && (
        <div className="cnd-detail-decision-row">
          <button
            className="cnd-action-btn cnd-action-reject"
            onClick={handleReject}
            disabled={actionBusy || isVacancyOnHold}
            title={isVacancyOnHold ? "This vacancy is on hold" : undefined}
          >
            Reject
          </button>
          <button
            className="cnd-action-btn cnd-action-shortlist"
            onClick={handleShortlist}
            disabled={actionBusy || isVacancyOnHold}
            title={isVacancyOnHold ? "This vacancy is on hold" : undefined}
          >
            Shortlist
          </button>
        </div>
      )}

      {row.stage === "REJECTED" && !row.hiringDecision && (
        <div className="cnd-detail-decision-row cnd-detail-decision-row-space">
          <p className="cnd-muted">
            Rejected before being shortlisted. There's no way to reapply for this vacancy, but you can reconsider
            them instead.
          </p>
          <button
            className="cnd-action-btn cnd-action-shortlist"
            onClick={handleReconsider}
            disabled={actionBusy || isVacancyOnHold}
            title={isVacancyOnHold ? "This vacancy is on hold" : undefined}
          >
            Reconsider
          </button>
        </div>
      )}

    </div>
  );
}
