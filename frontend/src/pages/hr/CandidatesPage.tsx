import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  listCandidates,
  applyCandidateToVacancy,
  extractCvFiles,
  confirmCvUpload,
  type CandidateApplicationRow,
  type RecruitmentStage,
  type ExtractedCvFile,
  type VacancyStageSummary,
  type FailedCvFile,
} from "../../api/candidates";
import { listVacancies, type Vacancy } from "../../api/vacancy";
import { listVacancyStages } from "../../api/vacancyStages";
import Toast from "../../components/Toast";
import "./CandidatesPage.css";

const STAGE_LABELS: Record<RecruitmentStage, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

// US-09: status marker, derived from `stage` rather than stored separately.
// Frontend-corrections pass (2nd round): "Unreviewed" is the CV's default
// state right after upload (nobody's screened it yet, matches the AC's own
// "unreviewed" wording -- relabeled from "In Progress" which read as though
// something was actively happening) -- it becomes "Shortlisted" once HR
// reviews/shortlists it. This is deliberately not re-derived from
// currentVacancyStageId anymore -- once shortlisted, this candidate reads
// "Shortlisted" here for their whole time in the pipeline; which specific
// interview round they're in is the Stage column's job (see
// stageDisplayFor below), not this one's.
function statusFor(row: CandidateApplicationRow): { label: string; cls: string } {
  if (row.stage === "APPLIED") {
    return { label: "Unreviewed", cls: "cnd-status cnd-status-blue" };
  }
  if (row.stage === "SHORTLISTED") {
    // Swapped per follow-up correction: Shortlisted now reads yellow,
    // Hired now reads green (was the other way around, see below).
    return { label: "Shortlisted", cls: "cnd-status cnd-status-yellow" };
  }
  if (row.stage === "HIRED") {
    return { label: "Hired", cls: "cnd-status cnd-status-green" };
  }
  if (row.stage === "REJECTED") {
    return { label: "Rejected", cls: "cnd-status cnd-status-red" };
  }
  return { label: STAGE_LABELS[row.stage], cls: "cnd-status cnd-status-plain" };
}

// Correction: originally only covered Unreviewed/Shortlisted on the theory
// that Hired/Rejected were "covered by the interview-stage filter instead" --
// but that filter is about which specific round a candidate is in, not a
// substitute for filtering by final outcome, and a lecturer asking "show me
// everyone rejected" has no way to do that otherwise. All four
// CandidateApplication.stage values are real filter options now.
function statusBucketFor(row: CandidateApplicationRow): "SHORTLISTED" | "IN_PROGRESS" | "HIRED" | "REJECTED" {
  if (row.stage === "APPLIED") return "IN_PROGRESS";
  if (row.stage === "SHORTLISTED") return "SHORTLISTED";
  if (row.stage === "HIRED") return "HIRED";
  return "REJECTED";
}

// Merged Stage column -- blank until this candidate has actually entered an
// interview round (a fresh upload, a bare shortlist, or a rejection that
// happened before ever reaching a round all have no round to show); once
// they're in one, shows that round's name (no order-number prefix -- just
// "Technical Interview", not "2. Technical Interview", per the wireframe).
// currentVacancyStage is kept as a historical breadcrumb even after Hired/
// Rejected (see schema comment on CandidateApplication.currentVacancyStageId),
// so a rejected candidate still shows which round they were rejected at --
// just "Technical Interview" (in red, via `rejected`), not "Technical
// Interview - Rejected". The word "Rejected" is dropped from this column's
// own text on direct user correction: the Status column already carries a
// red "REJECTED" pill on the same row (see statusFor), so repeating the word
// here was redundant -- the red colour on this column is what ties it back
// to that same rejection, no second label needed. A rejection with no round
// at all is still signaled by the Status column alone -- this column just
// stays blank rather than showing nothing-but-red with no round name.
// Narrow structural type (rather than the full CandidateApplicationRow) so
// this can also be reused for CandidateApplicationHistoryEntry rows in the
// candidate detail view's Applicant History list.
function stageDisplayFor(row: {
  stage: RecruitmentStage;
  currentVacancyStage: VacancyStageSummary | null;
}): { text: string; rejected: boolean } {
  const roundName = row.currentVacancyStage?.name ?? "";

  // Direct user correction: a rejection that happened at CV review -- before
  // this candidate ever reached a configured interview round -- used to fall
  // straight through to a blank cell here, which read as though the row was
  // missing data rather than showing a real, meaningful stage. "Initial
  // Screening" names that CV-review stage explicitly instead of leaving it
  // empty. A non-rejected application with no round yet (freshly applied,
  // or shortlisted but not yet advanced into round 1) still shows blank --
  // that gap is real too, but only a rejection needs a label standing in for
  // "this is where they were rejected."
  if (!roundName) {
    if (row.stage === "REJECTED") return { text: "Initial Screening", rejected: true };
    return { text: "", rejected: false };
  }

  if (row.stage === "REJECTED") {
    return { text: roundName, rejected: true };
  }
  return { text: roundName, rejected: false };
}

// One row in the CV Review & Confirm step -- starts from what extraction
// found, editable before the candidate/application is actually created.
type ReviewRow = ExtractedCvFile & {
  name: string;
  email: string;
  phoneNumber: string;
  status: "pending" | "saving" | "done" | "error";
  resultMessage?: string;
};

type UploadStep = "select" | "review";

// SCRUM2-30 (duplicate candidate detection): one entry per existing-candidate
// email match a confirmCvUpload batch produced -- purely informational, shown
// in a separate centered modal once the upload modal closes so HR can click
// through and confirm it's really the same person. `applicationId` is the
// application to link to when known (always known for a same-vacancy match;
// for a cross-vacancy match it's filled in from the apply loop below, once
// the new application has actually been created).
type DuplicateMatch = {
  fileId: string;
  message: string;
  applicationId: number | null;
};

export default function CandidatesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Reject/Shortlist on the Candidate Detail page navigate back here with a
  // one-shot toast in router state (same pattern as FeedbackPage.tsx ->
  // MyCandidatesPage.tsx) so HR sees confirmation of what just happened,
  // rather than the page just silently redirecting. Captured once on mount,
  // then cleared via replace so a refresh/back doesn't re-show a stale toast.
  const [decisionToast, setDecisionToast] = useState<string | null>(
    () => (location.state as { toast?: string } | null)?.toast ?? null
  );
  useEffect(() => {
    if (location.state && (location.state as { toast?: string }).toast) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = useState<CandidateApplicationRow[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Which vacancies/interview-rounds actually have at least one candidate
  // application -- deliberately independent of the active filters above
  // (rows is the FILTERED table data, so deriving "has candidates" from it
  // would be self-referential: picking a vacancy filter would make every
  // other vacancy look empty). Populated from one unfiltered fetch, so a
  // vacancy/stage the lecturer picks from these two dropdowns always has at
  // least one real row to show -- otherwise she'd land on a blank table and
  // reasonably ask why a vacancy is listed at all with nothing in it.
  const [vacancyIdsWithCandidates, setVacancyIdsWithCandidates] = useState<Set<number>>(new Set());
  const [stageIdsWithCandidates, setStageIdsWithCandidates] = useState<Set<number>>(new Set());

  async function refreshPopulatedFilterIds() {
    try {
      const all = await listCandidates({});
      setVacancyIdsWithCandidates(new Set(all.map((r) => r.vacancyId)));
      setStageIdsWithCandidates(
        new Set(all.map((r) => r.currentVacancyStageId).filter((id): id is number => id !== null))
      );
    } catch {
      // Non-critical -- worst case the dropdowns just show every vacancy/
      // stage again (the pre-fix behavior), not a broken page.
    }
  }

  const [search, setSearch] = useState("");
  // Frontend-corrections pass: "Stage" now filters by a specific interview
  // round (e.g. "Software Engineer - Technical Interview"), not the coarse
  // Applied/Shortlisted/Hired/Rejected anchor -- see vacancyStageOptions.
  const [vacancyStageFilter, setVacancyStageFilter] = useState<number | "ALL">("ALL");
  const [vacancyStageOptions, setVacancyStageOptions] = useState<
    { id: number; label: string }[]
  >([]);
  const [vacancyFilter, setVacancyFilter] = useState<number | "ALL">("ALL");
  // Status is a derived grouping (see statusFor()/statusBucketFor() above) --
  // only Shortlisted / In Progress, since this screen is specifically where
  // HR screens CVs and moves candidates through rounds. Applied purely
  // client-side since it's derived from data already loaded.
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SHORTLISTED" | "IN_PROGRESS" | "HIRED" | "REJECTED">("ALL");
  // Minimum interview feedback score -- server-side (candidate.controller.ts
  // already supported this; the frontend control was the missing piece).
  const [minScore, setMinScore] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>("select");
  const [uploadVacancyId, setUploadVacancyId] = useState<number | "">("");
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [confirmFailNotice, setConfirmFailNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // SCRUM2-30: existing-candidate matches from the most recent upload batch,
  // shown in their own centered modal once the upload modal closes.
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[] | null>(null);
  // Frontend-corrections pass: real drag-and-drop dropzone (dragActive is
  // just hover styling while a drag is over it) and files that failed the
  // PDF-only check server-side -- shown as a persistent "Failed" row rather
  // than a one-off alert, and carried through to the review step so HR can
  // still see what didn't make it in.
  const [dragActive, setDragActive] = useState(false);
  const [failedFiles, setFailedFiles] = useState<FailedCvFile[]>([]);
  const [showFailedNotice, setShowFailedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshPopulatedFilterIds();
    listVacancies()
      .then((vacs) => {
        setVacancies(vacs);
        // Build the "Vacancy - Round Name" options for the interview-stage
        // filter -- one lookup per vacancy since there's no single endpoint
        // for "every stage across every vacancy." Fine at this data scale;
        // revisit with a real aggregate endpoint if the vacancy count grows.
        Promise.all(
          vacs.map((v) =>
            listVacancyStages(v.id)
              .then((res) => res.stages.map((s) => ({ id: s.id, label: `${v.title} - ${s.name}` })))
              .catch(() => [])
          )
        ).then((lists) => setVacancyStageOptions(lists.flat()));
      })
      .catch(() => {});
  }, []);

  // Search/Stage/Vacancy/Score are all sent to the server (candidate.
  // controller.ts already supports all four) -- debounced so typing in the
  // search box doesn't fire a request per keystroke. Status stays client-
  // side (see statusFilter above) since it's a derived grouping, not a
  // separate stored/queryable field.
  useEffect(() => {
    const parsedMinScore = minScore.trim() ? Number(minScore) : undefined;
    const t = setTimeout(() => {
      refresh({
        search: search.trim() || undefined,
        vacancyStageId: vacancyStageFilter === "ALL" ? undefined : vacancyStageFilter,
        vacancyId: vacancyFilter === "ALL" ? undefined : vacancyFilter,
        minScore: parsedMinScore !== undefined && !Number.isNaN(parsedMinScore) ? parsedMinScore : undefined,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, vacancyStageFilter, vacancyFilter, minScore]);

  async function refresh(filters: Parameters<typeof listCandidates>[0] = {}) {
    setLoading(true);
    setError("");
    try {
      const data = await listCandidates(filters);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load candidates");
    } finally {
      setLoading(false);
    }
  }

  // Re-reads current filter state -- used after an action (shortlist/reject/
  // upload) so the refetch doesn't silently drop whatever filters were
  // active, which the debounced effect's own refresh() call would do if
  // called with no arguments.
  function currentFilters() {
    const parsedMinScore = minScore.trim() ? Number(minScore) : undefined;
    return {
      search: search.trim() || undefined,
      vacancyStageId: vacancyStageFilter === "ALL" ? undefined : vacancyStageFilter,
      vacancyId: vacancyFilter === "ALL" ? undefined : vacancyFilter,
      minScore: parsedMinScore !== undefined && !Number.isNaN(parsedMinScore) ? parsedMinScore : undefined,
    };
  }

  // Status ordering (top to bottom): In Progress -> Shortlisted -> Hired ->
  // Rejected -- the still-actionable ones surface first, fully-resolved
  // candidates sink down, Rejected sinks furthest since it's the least
  // actionable of all. Within "In Progress" specifically, most-recently-
  // reviewed floats to the top of that bucket: this is the CV-handoff case
  // (an HR officer was mid-review and had to step away) -- the next HR
  // officer opening this screen sees which CV a colleague was just looking
  // at, right at the top, instead of having to open candidates one at a time
  // to find it. Never-reviewed rows (lastCvReviewedAt is null) sink to the
  // bottom of the In Progress bucket. Shortlisted keeps the older "further
  // along the round order floats up" behavior; Hired/Rejected just fall back
  // to most-recently-applied.
  const STAGE_RANK: Record<RecruitmentStage, number> = {
    APPLIED: 0,
    SHORTLISTED: 1,
    HIRED: 2,
    REJECTED: 3,
  };
  const filteredRows = useMemo(() => {
    const base = statusFilter === "ALL" ? rows : rows.filter((r) => statusBucketFor(r) === statusFilter);
    return [...base].sort((a, b) => {
      const rankDiff = STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
      if (rankDiff !== 0) return rankDiff;

      if (a.stage === "APPLIED") {
        const aReviewed = a.candidate.lastCvReviewedAt ? new Date(a.candidate.lastCvReviewedAt).getTime() : 0;
        const bReviewed = b.candidate.lastCvReviewedAt ? new Date(b.candidate.lastCvReviewedAt).getTime() : 0;
        if (aReviewed !== bReviewed) return bReviewed - aReviewed;
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      }

      if (a.stage === "SHORTLISTED") {
        const aOrder = a.currentVacancyStage?.order ?? -1;
        const bOrder = b.currentVacancyStage?.order ?? -1;
        if (aOrder !== bOrder) return bOrder - aOrder;
      }

      return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
    });
  }, [rows, statusFilter]);

  // Compact "5m ago" / "3h ago" / "2d ago" label for the In Progress
  // handoff indicator -- falls back to a plain date once it's more than a
  // week old, since "9d ago" is less useful than a real date at that point.
  function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function openUploadModal() {
    setUploadStep("select");
    setUploadVacancyId("");
    setPickedFiles([]);
    setUploadError("");
    setReviewRows([]);
    setFailedFiles([]);
    setShowFailedNotice(false);
    setConfirmFailNotice(null);
    setDragActive(false);
    setDuplicateMatches(null);
    setUploadOpen(true);
  }

  function handleFilesPicked(fileList: FileList | null) {
    if (!fileList) return;
    // Root cause of the "browse files doesn't select anything" bug:
    // e.target.files is a *live* FileList tied to the input element, not a
    // frozen snapshot. The onChange handler below calls this function and
    // then immediately resets e.target.value = "" (so picking the same
    // file twice in a row still fires a change event) -- but React defers
    // running a setState updater callback, so by the time
    // `(prev) => [...prev, ...Array.from(fileList)]` actually ran, the
    // value reset had already cleared the live FileList out from under it,
    // silently turning every pick into a no-op. Converting to a plain
    // array right here, synchronously, before anything else touches the
    // input, freezes the actual File objects so the later value reset
    // can't retroactively empty them.
    const newFiles = Array.from(fileList);
    // Additive -- dropping/browsing more than once before hitting Extract
    // keeps everything picked so far, rather than replacing the selection.
    setPickedFiles((prev) => [...prev, ...newFiles]);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
    handleFilesPicked(e.dataTransfer.files);
  }

  async function handleExtract() {
    if (!uploadVacancyId) {
      setUploadError("Select a vacancy to apply these candidates to.");
      return;
    }
    if (pickedFiles.length === 0) {
      setUploadError("Choose at least one PDF CV to upload.");
      return;
    }
    setExtracting(true);
    setUploadError("");
    try {
      const { files, failed } = await extractCvFiles(pickedFiles);
      setPickedFiles([]); // this batch is fully processed either way -- don't resend on a retry
      setReviewRows(
        files.map((f) => ({
          ...f,
          name: f.extractedName ?? "",
          email: f.extractedEmail ?? "",
          phoneNumber: f.extractedPhone ?? "",
          status: "pending",
        }))
      );
      setFailedFiles(failed);
      setShowFailedNotice(failed.length > 0);
      if (files.length === 0 && failed.length > 0) {
        // Nothing usable came out of this batch -- stay on the select step
        // (with the dropzone + failed-files table both visible) rather than
        // moving to an empty review step.
        setUploadError("");
      } else {
        setUploadStep("review");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read CV files");
    } finally {
      setExtracting(false);
    }
  }

  function updateReviewRow(fileId: string, patch: Partial<ReviewRow>) {
    setReviewRows((prev) => prev.map((r) => (r.fileId === fileId ? { ...r, ...patch } : r)));
  }

  async function handleConfirmAndApply() {
    if (!uploadVacancyId) return;
    const vacancyId = uploadVacancyId;

    const incomplete = reviewRows.find((r) => !r.name.trim() || !r.email.trim());
    if (incomplete) {
      setUploadError("Every candidate needs at least a name and email before confirming.");
      return;
    }

    setConfirming(true);
    setUploadError("");
    setConfirmFailNotice(null);
    let successCount = 0;
    const failReasons: string[] = [];

    try {
      const result = await confirmCvUpload(
        reviewRows.map((r) => ({
          fileId: r.fileId,
          name: r.name.trim(),
          email: r.email.trim(),
          ...(r.phoneNumber.trim() ? { phoneNumber: r.phoneNumber.trim() } : {}),
        })),
        vacancyId
      );

      // Every entry in `created` gets applied to the vacancy -- brand-new
      // candidates and existing candidates reused for a genuinely different
      // vacancy both land here (see candidate.controller.ts's
      // confirmCvUpload); neither can conflict, since a same-vacancy match
      // never reaches `created` at all. Tracked by candidateId so a
      // same-email-different-vacancy match's `matched` entry below can link
      // to the application id this loop just created for it.
      const applicationIdByCandidateId = new Map<number, number>();
      for (const c of result.created) {
        try {
          const application = await applyCandidateToVacancy(vacancyId, c.candidateId);
          applicationIdByCandidateId.set(c.candidateId, application.id);
          successCount++;
        } catch (err) {
          failReasons.push(err instanceof Error ? err.message : "Could not apply this candidate to the vacancy");
        }
      }

      // SCRUM2-30 (duplicate candidate detection): an existing-candidate
      // email match is purely informational here -- nothing left to decide,
      // just a notice HR can click through on to confirm it's the same
      // person. Shown in its own modal once this one closes.
      const matches: DuplicateMatch[] = result.matched.map((m) => ({
        fileId: m.fileId,
        message: m.alreadyOnThisVacancy
          ? `${m.existingName} has already applied to this vacancy.`
          : `${m.existingName} already has a candidate profile and has also applied to this vacancy.`,
        applicationId: m.alreadyOnThisVacancy ? m.applicationId : applicationIdByCandidateId.get(m.candidateId) ?? null,
      }));

      for (const failure of result.failed) {
        failReasons.push(failure.error);
      }

      const total = successCount + matches.length + failReasons.length;
      if (failReasons.length === 0) {
        if (successCount > 0) {
          setUploadToast(`Successfully uploaded ${successCount} ${successCount === 1 ? "CV" : "CVs"}.`);
        }
        setUploadOpen(false);
        if (matches.length > 0) {
          setDuplicateMatches(matches);
        }
      } else {
        // Keep the modal open on failure instead of closing it -- the notice
        // is shown inline in the review step, same as the "PDF only"
        // rejection notice in the select step, rather than a toast.
        const uniqueReasons = Array.from(new Set(failReasons));
        const message =
          uniqueReasons.length === 1
            ? uniqueReasons[0]
            : `${failReasons.length} of ${total} CVs could not be uploaded: ${uniqueReasons.join("; ")}`;
        setConfirmFailNotice(message);
        if (matches.length > 0) {
          setDuplicateMatches(matches);
        }
      }

      await refresh(currentFilters());
      // A vacancy/round that had zero candidates before this upload should
      // become selectable in the filter dropdowns immediately, not only
      // after the page is reloaded.
      await refreshPopulatedFilterIds();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not confirm candidates");
    } finally {
      setConfirming(false);
    }
  }

  // Upload CVs is HR's "add a new candidate to this vacancy" entry point, so
  // it must respect the same freeze as the backend
  // (application.controller.ts's assertVacancyNotOnHold): CLOSED already
  // excluded a vacancy here, ON_HOLD now does too -- a frozen vacancy is
  // paused, not accepting new applicants, until it's reopened to OPEN.
  const applyableVacancies = vacancies.filter((v) => v.status === "OPEN");

  return (
    <div className="cnd-page">
      <div className="cnd-header-row">
        <h1 className="cnd-title">Candidates</h1>
        <button className="cnd-upload-btn" onClick={openUploadModal}>Upload CV</button>
      </div>
      <div className="cnd-divider" />

      <div className="cnd-filter-bar">
        <input
          className="cnd-search-input"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={vacancyFilter}
          onChange={(e) => setVacancyFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
        >
          <option value="ALL">All Vacancies</option>
          {vacancies
            .filter((v) => vacancyIdsWithCandidates.has(v.id))
            .map((v) => <option key={v.id} value={v.id}>{v.title} - {v.department}</option>)}
        </select>
        <select
          value={vacancyStageFilter}
          onChange={(e) => setVacancyStageFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
        >
          <option value="ALL">All Stages</option>
          {vacancyStageOptions
            .filter((s) => stageIdsWithCandidates.has(s.id))
            .map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="ALL">All Statuses</option>
          <option value="IN_PROGRESS">Unreviewed</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="HIRED">Hired</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select className="cnd-score-input" value={minScore} onChange={(e) => setMinScore(e.target.value)}>
          <option value="">Score</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {loading && <p className="cnd-muted">Loading...</p>}
      {error && <p className="cnd-error">{error}</p>}
      {!loading && filteredRows.length === 0 && <p className="cnd-muted">No candidates match these filters.</p>}

      {!loading && filteredRows.length > 0 && (
        <table className="cnd-table">
          <thead>
            <tr>
              <th>Candidate ID</th>
              <th>Candidate</th>
              <th>Vacancy</th>
              <th>Stage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const status = statusFor(r);
              const stageDisplay = stageDisplayFor(r);
              return (
                <tr key={r.id}>
                  <td className="cnd-id-cell">C-{String(r.candidateId).padStart(4, "0")}</td>
                  <td>
                    <button className="cnd-candidate-link" onClick={() => navigate(`/hr/candidates/${r.id}`)}>
                      <div className="cnd-candidate-name">{r.candidate.name}</div>
                      <div className="cnd-candidate-email">{r.candidate.email}</div>
                    </button>
                  </td>
                  <td>{r.vacancy.title}<div className="cnd-vacancy-dept">{r.vacancy.department}</div></td>
                  <td className={stageDisplay.rejected ? "cnd-stage-rejected" : undefined}>{stageDisplay.text}</td>
                  <td>
                    <span className={status.cls}>{status.label}</span>
                    {r.stage === "APPLIED" && r.candidate.lastCvReviewedBy && r.candidate.lastCvReviewedAt && (
                      <div className="cnd-reviewed-note">
                        Reviewed by {r.candidate.lastCvReviewedBy.name} &middot; {relativeTime(r.candidate.lastCvReviewedAt)}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {uploadOpen && (
        <div className="cnd-modal-backdrop" onClick={() => setUploadOpen(false)}>
          <div className="cnd-modal cnd-upload-modal" onClick={(e) => e.stopPropagation()}>
            {uploadStep === "select" && (
              <>
                <h2>Upload CVs</h2>
                <label htmlFor="cnd-vacancy-select">Apply to Vacancy</label>
                <select
                  id="cnd-vacancy-select"
                  value={uploadVacancyId}
                  onChange={(e) => setUploadVacancyId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select a vacancy</option>
                  {applyableVacancies.map((v) => (
                    <option key={v.id} value={v.id}>{v.title} - {v.department}</option>
                  ))}
                </select>

                {/* Uses a real <label htmlFor> association instead of a JS
                    ref.click() call to open the file picker. The previous
                    ref-click approach still didn't reliably register a
                    selection -- a native label/input pairing is standard
                    browser behavior with no click-bubbling or dialog-timing
                    edge cases to worry about. */}
                <label
                  htmlFor="cnd-file-input"
                  className={`cnd-dropzone${dragActive ? " cnd-dropzone-active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <p className="cnd-dropzone-text">Drag and Drop CVs here, or browse</p>
                  <p className="cnd-dropzone-subtext">(PDF documents only)</p>
                  <span className="cnd-browse-btn">Browse Files</span>
                  <input
                    id="cnd-file-input"
                    ref={fileInputRef}
                    className="cnd-file-input-hidden"
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    onChange={(e) => {
                      handleFilesPicked(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {pickedFiles.length > 0 && (
                  <p className="cnd-muted">
                    {pickedFiles.length} file(s) ready to extract: {pickedFiles.map((f) => f.name).join(", ")}
                  </p>
                )}

                {showFailedNotice && (
                  <div className="cnd-upload-notice">
                    <span className="cnd-upload-notice-icon">!</span>
                    <div>
                      <p className="cnd-upload-notice-title">Some files have not been uploaded</p>
                      <p className="cnd-upload-notice-body">Only PDF documents are supported.</p>
                    </div>
                    <button
                      type="button"
                      className="cnd-upload-notice-close"
                      onClick={() => setShowFailedNotice(false)}
                      aria-label="Close"
                    >
                      &#10005;
                    </button>
                  </div>
                )}

                {failedFiles.length > 0 && (
                  <table className="cnd-failed-table">
                    <thead>
                      <tr><th>Candidate</th><th>CV</th></tr>
                    </thead>
                    <tbody>
                      {failedFiles.map((f) => (
                        <tr key={f.originalName}>
                          <td>{f.originalName}</td>
                          <td className="cnd-stage-rejected">Failed</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {uploadError && <p className="cnd-error">{uploadError}</p>}

                <div className="cnd-modal-actions">
                  <button className="cnd-cancel-btn" onClick={() => setUploadOpen(false)}>Cancel</button>
                  <button className="cnd-save-btn" onClick={handleExtract} disabled={extracting || pickedFiles.length === 0}>
                    {extracting ? "Reading..." : "Extract"}
                  </button>
                </div>
              </>
            )}

            {uploadStep === "review" && (
              <>
                <h2>Review Candidates</h2>
                <p className="cnd-muted">
                  Extracted from the uploaded PDFs - correct any fields before confirming.
                </p>
                {failedFiles.length > 0 && (
                  <table className="cnd-failed-table">
                    <thead>
                      <tr><th>Candidate</th><th>CV</th></tr>
                    </thead>
                    <tbody>
                      {failedFiles.map((f) => (
                        <tr key={f.originalName}>
                          <td>{f.originalName}</td>
                          <td className="cnd-stage-rejected">Failed</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="cnd-review-list">
                  {reviewRows.map((r) => (
                    <div key={r.fileId} className="cnd-review-row">
                      <div className="cnd-review-filename">{r.originalName}</div>
                      <label>Name</label>
                      <input value={r.name} onChange={(e) => updateReviewRow(r.fileId, { name: e.target.value })} />
                      <label>Email</label>
                      <input value={r.email} onChange={(e) => updateReviewRow(r.fileId, { email: e.target.value })} />
                      <label>Phone</label>
                      <input
                        value={r.phoneNumber}
                        onChange={(e) => updateReviewRow(r.fileId, { phoneNumber: e.target.value })}
                      />
                    </div>
                  ))}
                  {reviewRows.length === 0 && <p className="cnd-muted">All files removed. Nothing to confirm.</p>}
                </div>

                {confirmFailNotice && (
                  <div className="cnd-upload-notice">
                    <span className="cnd-upload-notice-icon">!</span>
                    <div>
                      <p className="cnd-upload-notice-title">Some CVs could not be uploaded</p>
                      <p className="cnd-upload-notice-body">{confirmFailNotice}</p>
                    </div>
                    <button
                      type="button"
                      className="cnd-upload-notice-close"
                      onClick={() => setConfirmFailNotice(null)}
                      aria-label="Dismiss"
                    >
                      &#10005;
                    </button>
                  </div>
                )}

                {uploadError && <p className="cnd-error">{uploadError}</p>}

                <div className="cnd-modal-actions">
                  <button className="cnd-cancel-btn" onClick={() => setUploadStep("select")}>Back</button>
                  <button
                    className="cnd-save-btn"
                    onClick={handleConfirmAndApply}
                    disabled={confirming || reviewRows.length === 0}
                  >
                    {confirming ? "Saving..." : "Confirm & Apply"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SCRUM2-30 (duplicate candidate detection): a plain informational
          notice for every existing-candidate email match the most recent
          upload produced -- shown as its own centered modal once the upload
          modal closes, since it's no longer something HR needs to resolve. */}
      {duplicateMatches && duplicateMatches.length > 0 && (
        <div className="cnd-modal-backdrop" onClick={() => setDuplicateMatches(null)}>
          <div className="cnd-modal cnd-duplicate-modal" onClick={(e) => e.stopPropagation()}>
            <span className="cnd-duplicate-modal-icon">!</span>
            <h2>{duplicateMatches.length > 1 ? "Existing candidates found" : "Existing candidate found"}</h2>
            <div className="cnd-duplicate-list">
              {duplicateMatches.map((m) => (
                <div key={m.fileId} className="cnd-duplicate-row">
                  <p>{m.message}</p>
                  {m.applicationId !== null && (
                    <Link
                      to={`/hr/candidates/${m.applicationId}`}
                      className="cnd-duplicate-link"
                      onClick={() => setDuplicateMatches(null)}
                    >
                      View their profile &rarr;
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <div className="cnd-modal-actions">
              <button className="cnd-cancel-btn" onClick={() => setDuplicateMatches(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {uploadToast && (
        <Toast message={uploadToast} duration={8000} dismissible onClose={() => setUploadToast(null)} />
      )}

      {decisionToast && (
        <Toast message={decisionToast} duration={6000} dismissible onClose={() => setDecisionToast(null)} />
      )}

    </div>
  );
}
