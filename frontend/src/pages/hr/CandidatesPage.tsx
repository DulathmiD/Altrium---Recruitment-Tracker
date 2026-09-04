import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  listCandidates,
  applyCandidateToVacancy,
  extractCvFiles,
  confirmCvUpload,
  fetchCvBlobUrl,
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
// Frontend-corrections pass (2nd round): "In Progress" is the CV's default
// state right after upload (nobody's screened it yet) -- it becomes
// "Shortlisted" once HR reviews/shortlists it. This is deliberately not
// re-derived from currentVacancyStageId anymore -- once shortlisted, this
// candidate reads "Shortlisted" here for their whole time in the pipeline;
// which specific interview round they're in is the Stage column's job (see
// stageDisplayFor below), not this one's.
function statusFor(row: CandidateApplicationRow): { label: string; cls: string } {
  if (row.stage === "APPLIED") {
    return { label: "In Progress", cls: "cnd-status cnd-status-blue" };
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

// Frontend-corrections pass: Status only ever means In Progress (freshly
// applied, not yet screened) or Shortlisted (HR has screened/shortlisted it)
// -- Hired/Rejected aren't part of this filter, they're covered by the
// interview-stage filter and the merged Stage column instead.
function statusBucketFor(row: CandidateApplicationRow): "SHORTLISTED" | "IN_PROGRESS" | null {
  if (row.stage === "APPLIED") return "IN_PROGRESS";
  if (row.stage === "SHORTLISTED") return "SHORTLISTED";
  return null;
}

// Merged Stage column -- blank until this candidate has actually entered an
// interview round (a fresh upload, a bare shortlist, or a rejection that
// happened before ever reaching a round all have no round to show); once
// they're in one, shows that round's name (no order-number prefix -- just
// "Technical Interview", not "2. Technical Interview", per the wireframe).
// currentVacancyStage is kept as a historical breadcrumb even after Hired/
// Rejected (see schema comment on CandidateApplication.currentVacancyStageId),
// so a rejected candidate still shows which round they were rejected at,
// e.g. "Technical Interview - Rejected" in red. A rejection with no round at
// all is signaled by the Status column ("Rejected" in red, see statusFor)
// instead -- this column just stays blank rather than repeating "Rejected"
// with nothing in front of it.
// Narrow structural type (rather than the full CandidateApplicationRow) so
// this can also be reused for CandidateApplicationHistoryEntry rows in the
// candidate detail view's Applicant History list.
function stageDisplayFor(row: {
  stage: RecruitmentStage;
  currentVacancyStage: VacancyStageSummary | null;
}): { text: string; rejected: boolean } {
  const roundName = row.currentVacancyStage?.name ?? "";
  if (!roundName) return { text: "", rejected: false };

  if (row.stage === "REJECTED") {
    return { text: `${roundName} - Rejected`, rejected: true };
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

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CandidateApplicationRow[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SHORTLISTED" | "IN_PROGRESS">("ALL");
  // Minimum interview feedback score -- server-side (candidate.controller.ts
  // already supported this; the frontend control was the missing piece).
  const [minScore, setMinScore] = useState("");

  const [actionError, setActionError] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>("select");
  const [uploadVacancyId, setUploadVacancyId] = useState<number | "">("");
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [confirmFailNotice, setConfirmFailNotice] = useState<string | null>(null);
  // SCRUM2-30: separate from confirmFailNotice on purpose -- a matched
  // duplicate isn't a failure, the application still gets created.
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  // Frontend-corrections pass: candidates who've been passed on to a later
  // round float to the top, rejected candidates sink to the bottom -- so the
  // "All Stages" view stays organized without HR having to filter it down.
  // Rejected first check, then by how far along they are (round order),
  // then by most recently applied as a tiebreaker (no per-row "last stage
  // change" timestamp is available on this list endpoint).
  const filteredRows = useMemo(() => {
    const base = statusFilter === "ALL" ? rows : rows.filter((r) => statusBucketFor(r) === statusFilter);
    return [...base].sort((a, b) => {
      if (a.stage === "REJECTED" && b.stage !== "REJECTED") return 1;
      if (b.stage === "REJECTED" && a.stage !== "REJECTED") return -1;
      const aOrder = a.currentVacancyStage?.order ?? (a.stage === "HIRED" ? 999 : -1);
      const bOrder = b.currentVacancyStage?.order ?? (b.stage === "HIRED" ? 999 : -1);
      if (aOrder !== bOrder) return bOrder - aOrder;
      return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
    });
  }, [rows, statusFilter]);

  async function handleViewCv(candidateId: number) {
    setActionError("");
    try {
      const url = await fetchCvBlobUrl(candidateId);
      window.open(url, "_blank");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not open CV");
    }
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
    setDuplicateNotice(null);
    let successCount = 0;
    const failReasons: string[] = [];
    const duplicateNotes: string[] = [];
    try {
      const result = await confirmCvUpload(
        reviewRows.map((r) => ({
          fileId: r.fileId,
          name: r.name.trim(),
          email: r.email.trim(),
          ...(r.phoneNumber.trim() ? { phoneNumber: r.phoneNumber.trim() } : {}),
        }))
      );

      // Newly created candidates: apply them to the chosen vacancy.
      for (const created of result.created) {
        try {
          await applyCandidateToVacancy(vacancyId, created.candidateId);
          successCount++;
        } catch (err) {
          failReasons.push(err instanceof Error ? err.message : "Could not apply this candidate to the vacancy");
        }
      }

      // SCRUM2-30 (duplicate candidate detection): the backend already
      // detected these emails belong to an existing candidate and did not
      // create a second Candidate row (see candidate.controller.ts). Apply
      // the existing record to this vacancy, and explicitly tell HR this CV
      // matched someone already in the system -- "warn, don't block" means
      // HR is informed, not that the app pretends nothing happened.
      for (const match of result.matched) {
        try {
          await applyCandidateToVacancy(vacancyId, match.candidateId);
          successCount++;
          duplicateNotes.push(
            match.existingVacancies.length > 0
              ? `${match.existingName} already has a profile with us, so we linked this CV to their existing application for ${match.existingVacancies.join(", ")}.`
              : `${match.existingName} already has a profile with us, so we linked this CV to it instead of creating a new one.`
          );
        } catch (err) {
          failReasons.push(err instanceof Error ? err.message : "Could not apply this candidate to the vacancy");
        }
      }

      // Failed creates: whatever the backend-reported reason (missing
      // fields, expired upload), kept verbatim so the notice below can name
      // the actual cause instead of a vague fallback.
      for (const failure of result.failed) {
        failReasons.push(failure.error);
      }

      if (duplicateNotes.length > 0) {
        setDuplicateNotice(duplicateNotes.join(" "));
      }

      // Single toast instead of a separate "Upload Complete" summary step --
      // per user feedback, HR just wants confirmation, not a per-file list.
      // Kept strictly separate from failures: the success toast never
      // mentions failed counts -- any failure instead surfaces via the same
      // red notice style used for the "PDF only" rejection in the select
      // step, per user feedback. The notice names the actual reason instead
      // of a generic phrase: the most common real cause is the candidate
      // having already applied to this vacancy (a duplicate CV for the same
      // vacancy), which the backend reports verbatim -- so that's called out
      // by name when it's the only reason. Other backend-reported reasons
      // (e.g. an expired upload) are shown as-is rather than invented.
      const total = successCount + failReasons.length;
      if (failReasons.length === 0) {
        setUploadToast(`Successfully uploaded ${total} ${total === 1 ? "CV" : "CVs"}.`);
        setUploadOpen(false);
      } else {
        // Keep the modal open on failure instead of closing it -- the notice
        // is shown inline in the review step, same as the "PDF only"
        // rejection notice in the select step, rather than a toast.
        const isAllDuplicates = failReasons.every((r) => /already applied to this vacancy/i.test(r));
        const uniqueReasons = Array.from(new Set(failReasons));
        const message = isAllDuplicates
          ? failReasons.length === 1
            ? "This CV has already been uploaded to this vacancy."
            : "These CVs have already been uploaded to this vacancy."
          : uniqueReasons.length === 1
            ? uniqueReasons[0]
            : `${failReasons.length} of ${total} CVs could not be uploaded: ${uniqueReasons.join("; ")}`;
        setConfirmFailNotice(message);
      }

      await refresh(currentFilters());
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not confirm candidates");
    } finally {
      setConfirming(false);
    }
  }

  const applyableVacancies = vacancies.filter((v) => v.status !== "CLOSED");

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
          {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title} - {v.department}</option>)}
        </select>
        <select
          value={vacancyStageFilter}
          onChange={(e) => setVacancyStageFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
        >
          <option value="ALL">All Stages</option>
          {vacancyStageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="ALL">All Statuses</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="IN_PROGRESS">In Progress</option>
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
      {actionError && <p className="cnd-error">{actionError}</p>}
      {!loading && filteredRows.length === 0 && <p className="cnd-muted">No candidates match these filters.</p>}

      {!loading && filteredRows.length > 0 && (
        <table className="cnd-table">
          <thead>
            <tr>
              <th>Candidate ID</th>
              <th>Candidate</th>
              <th>CV</th>
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
                  <td>
                    <button className="cnd-link-btn" onClick={() => handleViewCv(r.candidateId)}>View</button>
                  </td>
                  <td>{r.vacancy.title}<div className="cnd-vacancy-dept">{r.vacancy.department}</div></td>
                  <td className={stageDisplay.rejected ? "cnd-stage-rejected" : undefined}>{stageDisplay.text}</td>
                  <td><span className={status.cls}>{status.label}</span></td>
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


      {uploadToast && (
        <Toast message={uploadToast} duration={8000} dismissible onClose={() => setUploadToast(null)} />
      )}

      {/* SCRUM2-30: rendered outside the modal (unlike confirmFailNotice)
          because a duplicate match isn't a failure -- the modal already
          closed on the success path by the time this needs to be seen. No
          auto-dismiss (duration 0): this is worth HR actually reading, not a
          one-line confirmation that can flash by. */}
      {duplicateNotice && (
        <Toast message={duplicateNotice} duration={0} dismissible onClose={() => setDuplicateNotice(null)} />
      )}

    </div>
  );
}
