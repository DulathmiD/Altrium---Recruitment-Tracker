import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  listCandidates,
  getCandidateDetail,
  saveCandidateReviewNote,
  type CandidateApplicationRow,
  type CandidateDetail,
  type RecruitmentStage,
} from "../../api/candidates";
import { updateApplicationStatus, assignHiringManager } from "../../api/applications";
import { listVacancyStages, type VacancyStage } from "../../api/vacancyStages";
import { listVacancyInterviewers, type VacancyInterviewer } from "../../api/vacancyInterviewers";
import { listAssignableStaff, roleLabel, type StaffMember } from "../../api/staff";
import { listInterviewsForApplication, scheduleInterview, type Interview } from "../../api/interviews";
import { stageDisplayFor } from "../../utils/candidateStage";
import "./CandidatesPage.css";

// Frontend-corrections pass: candidate detail moved from a modal to its own
// routed page ("/hr/candidates/:applicationId") per user feedback, with
// sections reordered: CV Preview first, then Review Notes, Applicant
// History, Hiring Manager, Interviews, Schedule Interview, and finally the
// Reject/Shortlist decision buttons at the very bottom (previously top).
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

  const [detailStages, setDetailStages] = useState<VacancyStage[]>([]);
  const [detailPanel, setDetailPanel] = useState<VacancyInterviewer[]>([]);
  const [detailInterviews, setDetailInterviews] = useState<Interview[]>([]);
  const [detailError, setDetailError] = useState("");

  const [hmOptions, setHmOptions] = useState<StaffMember[]>([]);
  const [hmSelection, setHmSelection] = useState<number | "">("");
  const [hmSaving, setHmSaving] = useState(false);
  const [hmError, setHmError] = useState("");

  const [scheduleStageId, setScheduleStageId] = useState<number | "">("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [schedulePanelistIds, setSchedulePanelistIds] = useState<number[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const [candidateDetail, setCandidateDetail] = useState<CandidateDetail | null>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(true);
  const [reviewNoteDraft, setReviewNoteDraft] = useState("");
  const [reviewNoteSaving, setReviewNoteSaving] = useState(false);
  const [reviewNoteError, setReviewNoteError] = useState("");

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
    Promise.all([
      listVacancyStages(row.vacancyId),
      listVacancyInterviewers(row.vacancyId),
      listInterviewsForApplication(row.id),
    ])
      .then(([stages, panel, interviews]) => {
        if (cancelled) return;
        setDetailStages(stages.stages);
        setDetailPanel(panel);
        setDetailInterviews(interviews);
        // Default the round picker to the next uncompleted round, matching
        // the same "next round" logic the ADVANCE recommendation uses
        // server-side -- just a sensible default, HR can still pick any
        // configured round.
        const idx = row.currentVacancyStageId
          ? stages.stages.findIndex((s) => s.id === row.currentVacancyStageId)
          : -1;
        const next = stages.stages[idx + 1];
        if (next) setScheduleStageId(next.id);
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
      navigate("/hr/candidates");
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
      navigate("/hr/candidates");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not shortlist candidate");
    } finally {
      setActionBusy(false);
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

  function togglePanelist(userId: number) {
    setSchedulePanelistIds((prev) => (prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]));
  }

  async function handleScheduleInterview() {
    if (!row) return;
    if (!scheduleStageId) {
      setScheduleError("Select a stage to schedule.");
      return;
    }
    if (!scheduleDateTime) {
      setScheduleError("Pick a date and time.");
      return;
    }
    if (schedulePanelistIds.length === 0) {
      setScheduleError("Select at least one panelist.");
      return;
    }
    setScheduling(true);
    setScheduleError("");
    try {
      await scheduleInterview(row.id, {
        vacancyStageId: scheduleStageId,
        scheduledAt: new Date(scheduleDateTime).toISOString(),
        panelistUserIds: schedulePanelistIds,
      });
      setSchedulePanelistIds([]);
      setScheduleDateTime("");
      const interviews = await listInterviewsForApplication(row.id);
      setDetailInterviews(interviews);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Could not schedule interview");
    } finally {
      setScheduling(false);
    }
  }

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

      {detailError && <p className="cnd-error">{detailError}</p>}
      {actionError && <p className="cnd-error">{actionError}</p>}

      <div className="cnd-detail-section">
        <label htmlFor="cnd-review-note">Review Notes</label>
        <p className="cnd-muted">
          Last Reviewed By: {candidateDetail?.lastCvReviewedBy ? candidateDetail.lastCvReviewedBy.name : "Not yet reviewed"}
          {candidateDetail?.lastCvReviewedAt && ` on ${new Date(candidateDetail.lastCvReviewedAt).toLocaleDateString()}`}
        </p>
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
          {candidateDetail?.emailHistory.map((e) => (
            <div key={e.id} className="cnd-summary-row">
              <span className="cnd-summary-name">{e.label}</span>
              <span className="cnd-muted">Sent &middot; {new Date(e.sentAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cnd-detail-section">
        <label>Hiring Manager</label>
        <p className="cnd-muted">Currently: {row.hiringManager ? row.hiringManager.name : "Unassigned"}</p>
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
      </div>

      <div className="cnd-detail-section">
        <label>Interviews</label>
        {detailInterviews.length === 0 && <p className="cnd-muted">No interviews scheduled yet.</p>}
        <div className="cnd-review-list">
          {detailInterviews.map((iv) => (
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
        <label>Schedule Interview</label>
        {row.stage !== "SHORTLISTED" && (
          <p className="cnd-muted">
            {row.stage === "APPLIED"
              ? "Shortlist this candidate first before scheduling an interview."
              : `This application has reached a final outcome (${STAGE_LABELS[row.stage]}) - no further interviews can be scheduled.`}
          </p>
        )}
        {row.stage === "SHORTLISTED" && detailStages.length === 0 && (
          <p className="cnd-muted">This vacancy has no interview stages configured yet - add one via Edit Vacancy first.</p>
        )}
        {row.stage === "SHORTLISTED" && detailPanel.length === 0 && (
          <p className="cnd-muted">This vacancy has no interview panel assigned yet - add staff via Edit Vacancy first.</p>
        )}
        {row.stage === "SHORTLISTED" && detailStages.length > 0 && detailPanel.length > 0 && (
          <>
            <label htmlFor="cnd-schedule-stage">Stage</label>
            <select
              id="cnd-schedule-stage"
              value={scheduleStageId}
              onChange={(e) => setScheduleStageId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select a stage</option>
              {detailStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.order}. {s.name}
                </option>
              ))}
            </select>

            <label htmlFor="cnd-schedule-datetime">Date &amp; Time</label>
            <input
              id="cnd-schedule-datetime"
              type="datetime-local"
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
            />

            <label>Panel</label>
            <div className="cnd-panel-checklist">
              {detailPanel.map((p) => (
                <label key={p.userId} className="cnd-panel-checkbox">
                  <input
                    type="checkbox"
                    checked={schedulePanelistIds.includes(p.userId)}
                    onChange={() => togglePanelist(p.userId)}
                  />
                  {p.user.name} - {roleLabel(p.user.role)}
                </label>
              ))}
            </div>

            {scheduleError && <p className="cnd-error">{scheduleError}</p>}

            <div className="cnd-inline-row">
              <button className="cnd-save-btn" onClick={handleScheduleInterview} disabled={scheduling}>
                {scheduling ? "Scheduling..." : "Schedule Interview"}
              </button>
            </div>
          </>
        )}
      </div>

      {row.stage === "APPLIED" && (
        <div className="cnd-detail-decision-row cnd-detail-decision-row-bottom">
          <button className="cnd-action-btn cnd-action-reject" onClick={handleReject} disabled={actionBusy}>
            Reject
          </button>
          <button className="cnd-action-btn cnd-action-shortlist" onClick={handleShortlist} disabled={actionBusy}>
            Shortlist
          </button>
        </div>
      )}
    </div>
  );
}
