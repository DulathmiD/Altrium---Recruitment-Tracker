import { useEffect, useRef, useState, type DragEvent } from "react";
import { listVacancies, createVacancy, updateVacancy, type Vacancy, type VacancyInput, type VacancyStatus } from "../../api/vacancy";
import {
  listVacancyStages,
  createVacancyStage,
  renameVacancyStage,
  deleteVacancyStage,
  reorderVacancyStages,
  type VacancyStage,
} from "../../api/vacancyStages";
import Toast from "../../components/Toast";
import "./VacanciesPage.css";

const STATUS_OPTIONS: VacancyStatus[] = ["OPEN", "ON_HOLD", "CLOSED"];
const STATUS_LABELS: Record<VacancyStatus, string> = {
  OPEN: "Open",
  ON_HOLD: "On Hold",
  CLOSED: "Closed",
};
const STATUS_BADGE_CLASS: Record<VacancyStatus, string> = {
  OPEN: "vac-badge vac-badge-open",
  ON_HOLD: "vac-badge vac-badge-hold",
  CLOSED: "vac-badge vac-badge-closed",
};
// Sort priority for the list: open first, then on hold, closed pushed to the bottom.
const STATUS_SORT_ORDER: Record<VacancyStatus, number> = {
  OPEN: 0,
  ON_HOLD: 1,
  CLOSED: 2,
};
const FILTER_OPTIONS: Array<{ value: VacancyStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "CLOSED", label: "Closed" },
];

const DEPARTMENTS = [
  "HR",
  "Finance and Accounting",
  "Operations",
  "Marketing",
  "Sales",
  "IT",
  "Customer Service",
  "Legal",
];

// targetFillDate kept as a plain string here (matches the <input type="date">
// value format, "" = unset) rather than VacancyInput's string|null|undefined --
// converted to null-or-value only when actually sent, in handleSave.
type FormState = Omit<VacancyInput, "targetFillDate"> & { targetFillDate: string };

const EMPTY_FORM: FormState = {
  title: "",
  department: "",
  description: "",
  requirements: "",
  preferredSkills: "",
  targetFillDate: "",
};

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VacancyStatus | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editStatus, setEditStatus] = useState<VacancyStatus>("OPEN");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // True while the modal is showing a vacancy that was just created in this
  // session (as opposed to an existing vacancy opened via the edit pencil).
  // Interview Stages are optional at creation time -- HR isn't required to
  // fill them in -- so the modal stays open after Save so they *can*, without
  // forcing it.
  const [justCreated, setJustCreated] = useState(false);
  // Frontend-corrections pass: the "Saved, add rounds below or skip" message
  // used to sit as static text at the top of the modal, easy to miss --
  // shown as a bottom toast instead, and the modal auto-scrolls to the
  // Interview Stages section so HR sees it's right there without scrolling
  // to look for it.
  const [saveToast, setSaveToast] = useState(false);
  const stagesSectionRef = useRef<HTMLDivElement>(null);

  // Interview Stages (US-05) -- shown once a vacancy exists (either an
  // existing one being edited, or one just created in this modal session).
  const [stages, setStages] = useState<VacancyStage[]>([]);
  const [stagesLocked, setStagesLocked] = useState(false);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stageError, setStageError] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [stageSavingId, setStageSavingId] = useState<number | "new" | null>(null);
  const [renamingStageId, setRenamingStageId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Drag-to-reorder state for the interview stages list (US-05 round order).
  const [dragStageId, setDragStageId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await listVacancies();
      setVacancies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vacancies");
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingId(null);
    setJustCreated(false);
    setForm({ ...EMPTY_FORM, department: selectedDepartment ?? "" });
    setFormError("");
    setStages([]);
    setStagesLocked(false);
    setStageError("");
    setNewStageName("");
    setRenamingStageId(null);
    setFormOpen(true);
  }

  function openEditForm(v: Vacancy) {
    setEditingId(v.id);
    setJustCreated(false);
    setForm({
      title: v.title,
      department: v.department,
      description: v.description,
      requirements: v.requirements ?? "",
      preferredSkills: v.preferredSkills ?? "",
      // Vacancy.targetFillDate comes back as a full ISO timestamp; <input
      // type="date"> needs just the YYYY-MM-DD portion.
      targetFillDate: v.targetFillDate ? v.targetFillDate.slice(0, 10) : "",
    });
    setEditStatus(v.status);
    setFormError("");
    setFormOpen(true);
    refreshStages(v.id);
  }

  async function refreshStages(vacancyId: number) {
    setStagesLoading(true);
    setStageError("");
    try {
      const data = await listVacancyStages(vacancyId);
      setStages(data.stages);
      setStagesLocked(data.locked);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Could not load interview rounds");
    } finally {
      setStagesLoading(false);
    }
  }

  async function handleAddStage() {
    if (!editingId || !newStageName.trim()) return;
    setStageSavingId("new");
    setStageError("");
    try {
      await createVacancyStage(editingId, newStageName.trim());
      setNewStageName("");
      await refreshStages(editingId);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Could not add round");
    } finally {
      setStageSavingId(null);
    }
  }

  function startRenameStage(stage: VacancyStage) {
    setRenamingStageId(stage.id);
    setRenameValue(stage.name);
    setStageError("");
  }

  async function handleRenameStage(stageId: number) {
    if (!editingId || !renameValue.trim()) return;
    setStageSavingId(stageId);
    setStageError("");
    try {
      await renameVacancyStage(editingId, stageId, renameValue.trim());
      setRenamingStageId(null);
      await refreshStages(editingId);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Could not rename round");
    } finally {
      setStageSavingId(null);
    }
  }

  async function handleDeleteStage(stageId: number) {
    if (!editingId) return;
    setStageSavingId(stageId);
    setStageError("");
    try {
      await deleteVacancyStage(editingId, stageId);
      await refreshStages(editingId);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Could not delete round");
    } finally {
      setStageSavingId(null);
    }
  }

  // Drag-and-drop reorder for interview stages -- picking up the "=" handle
  // on a row and dropping it on another reorders both, then persists the
  // whole new sequence via the existing reorder endpoint (order = array of
  // every stage id for this vacancy in the desired sequence).
  function handleStageDragStart(stageId: number) {
    if (stagesLocked) return;
    setDragStageId(stageId);
  }

  function handleStageDragOver(e: DragEvent, stageId: number) {
    if (stagesLocked || dragStageId === null) return;
    e.preventDefault();
    if (stageId !== dragOverStageId) setDragOverStageId(stageId);
  }

  function handleStageDragEnd() {
    setDragStageId(null);
    setDragOverStageId(null);
  }

  async function handleStageDrop(e: DragEvent, targetStageId: number) {
    e.preventDefault();
    setDragOverStageId(null);
    if (!editingId || stagesLocked || dragStageId === null || dragStageId === targetStageId) {
      setDragStageId(null);
      return;
    }
    const fromIndex = stages.findIndex((s) => s.id === dragStageId);
    const toIndex = stages.findIndex((s) => s.id === targetStageId);
    setDragStageId(null);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...stages];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setStages(reordered); // optimistic

    setReordering(true);
    setStageError("");
    try {
      const updated = await reorderVacancyStages(editingId, reordered.map((s) => s.id));
      setStages(updated);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Could not reorder rounds");
      await refreshStages(editingId); // roll back to server truth
    } finally {
      setReordering(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.department.trim() || !form.description.trim()) {
      setFormError("Title, department, and description are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    // "" from the date input means "no target date" -- must be sent as an
    // explicit null, not "", since the backend tries to parse it as a Date.
    const payload = { ...form, targetFillDate: form.targetFillDate ? form.targetFillDate : null };
    try {
      if (editingId) {
        // Either an existing vacancy being edited, or one just created in
        // this same modal session (see the createVacancy branch below) --
        // either way it now has an id, so this is always an update.
        await updateVacancy(editingId, { ...payload, status: editStatus });
        await refresh();
        setFormOpen(false);
      } else {
        // Stages can't be attached until the vacancy has an id, so creating
        // flips the same modal into an editing state rather than closing it.
        // Interview Stages are optional here -- HR can add rounds now or
        // skip and configure them later, both are fine.
        const created = await createVacancy(payload);
        setEditingId(created.id);
        setEditStatus(created.status);
        setJustCreated(true);
        await refreshStages(created.id);
        await refresh();

        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 10000);
        // Scroll after the stages/panel sections have actually rendered
        // (they're gated on editingId, which just got set above).
        setTimeout(() => {
          stagesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save vacancy");
    } finally {
      setSaving(false);
    }
  }

  const departmentVacancies = vacancies
    .filter((v) => v.department === selectedDepartment)
    .filter((v) => statusFilter === "ALL" || v.status === statusFilter)
    .sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status] || a.title.localeCompare(b.title));

  return (
    <div className="vac-page">
      {selectedDepartment === null ? (
        <>
          <h1 className="vac-title">Vacancies</h1>
          <div className="vac-divider" />
          {loading && <p className="vac-muted">Loading...</p>}
          {error && <p className="vac-error">{error}</p>}
          <div className="vac-dept-grid">
            {DEPARTMENTS.map((dept) => (
              <button key={dept} className="vac-dept-card" onClick={() => setSelectedDepartment(dept)}>
                {dept}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="vac-header-row">
            <div>
              <button
                className="vac-back"
                onClick={() => {
                  setSelectedDepartment(null);
                  setStatusFilter("ALL");
                }}
              >
                &larr; Departments
              </button>
              <h1 className="vac-title">{selectedDepartment}</h1>
            </div>
            <button className="vac-create-btn" onClick={openCreateForm}>Create Vacancy</button>
          </div>
          <div className="vac-divider" />
          <div className="vac-filter-bar">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`vac-filter-chip${statusFilter === opt.value ? " vac-filter-chip-active" : ""}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {loading && <p className="vac-muted">Loading...</p>}
          {error && <p className="vac-error">{error}</p>}
          {!loading && departmentVacancies.length === 0 && (
            <p className="vac-muted">
              {statusFilter === "ALL" ? "No vacancies in this department yet." : "No vacancies match this filter."}
            </p>
          )}
          <div className="vac-list">
            {departmentVacancies.map((v) => (
              <div
                key={v.id}
                className={`vac-row${v.status === "CLOSED" ? " vac-row-closed" : ""}`}
                data-testid="vac-row"
              >
                <span className="vac-row-title">{v.title}</span>
                <div className="vac-row-right">
                  <span className={STATUS_BADGE_CLASS[v.status]}>{STATUS_LABELS[v.status]}</span>
                  <button className="vac-edit-btn" onClick={() => openEditForm(v)} aria-label="Edit vacancy">
                    &#9998;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <div className="vac-modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="vac-modal" onClick={(e) => e.stopPropagation()}>
            <button className="vac-modal-close" onClick={() => setFormOpen(false)} aria-label="Close">
              &#10005;
            </button>
            <h2>{justCreated ? "Vacancy Created" : editingId ? "Edit Vacancy" : "Create Vacancy"}</h2>

            <label htmlFor="vac-title-input">Title</label>
            <input id="vac-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

            {/* Department is implied by whichever department page the vacancy
                lives under (form.department is pre-filled in both
                openCreateForm and openEditForm) -- the dropdown was removed
                from Create per the corrections doc, and removed from Edit
                too in the same pass since a vacancy's department shouldn't
                change after creation. form.department stays set under the
                hood so validation/save still work; there's just no UI to
                edit it. */}

            {editingId && (
              <>
                <label htmlFor="vac-status-select">Status</label>
                <select
                  id="vac-status-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as VacancyStatus)}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </>
            )}

            <label htmlFor="vac-description-input">Description</label>
            <textarea id="vac-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />

            <label htmlFor="vac-requirements-input">Requirements</label>
            <textarea id="vac-requirements-input" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={2} />

            <label htmlFor="vac-skills-input">Preferred Skills</label>
            <textarea id="vac-skills-input" value={form.preferredSkills} onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })} rows={2} />

            <label htmlFor="vac-target-date-input">Expected Hiring Date (optional)</label>
            <input
              id="vac-target-date-input"
              type="date"
              value={form.targetFillDate}
              onChange={(e) => setForm({ ...form, targetFillDate: e.target.value })}
            />

            {editingId && (
              <div className="vac-stages-section" ref={stagesSectionRef}>
                <label>Interview Stages (optional)</label>
                {stagesLocked && (
                  <p className="vac-stages-hint">
                    Locked - a candidate has already entered a round on this vacancy. Rounds can no longer be added, renamed, or removed.
                  </p>
                )}
                {stagesLoading && <p className="vac-muted">Loading rounds...</p>}
                {stageError && <p className="vac-error">{stageError}</p>}
                {reordering && <p className="vac-muted">Saving new order...</p>}
                <div className="vac-stages-list">
                  {stages.map((s) => (
                    <div
                      key={s.id}
                      className={
                        "vac-stage-row" +
                        (dragStageId === s.id ? " vac-stage-row-dragging" : "") +
                        (dragOverStageId === s.id && dragStageId !== s.id ? " vac-stage-row-dragover" : "")
                      }
                      onDragOver={(e) => handleStageDragOver(e, s.id)}
                      onDrop={(e) => handleStageDrop(e, s.id)}
                    >
                      <div className="vac-stage-left">
                        <span
                          className="vac-stage-drag-handle"
                          draggable={!stagesLocked}
                          aria-disabled={stagesLocked}
                          onDragStart={() => handleStageDragStart(s.id)}
                          onDragEnd={handleStageDragEnd}
                          aria-label="Drag to reorder round"
                          title={stagesLocked ? "Locked" : "Drag to reorder"}
                        >
                          &#8801;
                        </span>
                        {renamingStageId === s.id ? (
                          <input
                            className="vac-stage-rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="vac-stage-name">{s.order}. {s.name}</span>
                        )}
                      </div>
                      <div className="vac-stage-actions">
                        {renamingStageId === s.id ? (
                          <>
                            <button
                              type="button"
                              className="vac-stage-btn"
                              onClick={() => handleRenameStage(s.id)}
                              disabled={stageSavingId === s.id}
                            >
                              {stageSavingId === s.id ? "..." : "Save"}
                            </button>
                            <button type="button" className="vac-stage-btn" onClick={() => setRenamingStageId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="vac-stage-icon-btn"
                              onClick={() => startRenameStage(s)}
                              disabled={stagesLocked}
                              aria-label="Rename round"
                              title={stagesLocked ? "Locked" : "Rename round"}
                            >
                              &#9998;
                            </button>
                            <button
                              type="button"
                              className="vac-stage-icon-btn"
                              onClick={() => handleDeleteStage(s.id)}
                              disabled={stagesLocked || stageSavingId === s.id}
                              aria-label="Remove round"
                              title={stagesLocked ? "Locked" : "Remove round"}
                            >
                              &#10005;
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!stagesLocked && (
                  <div className="vac-stage-add-row">
                    <input
                      placeholder="New round name (e.g. Technical Interview)"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newStageName.trim() && stageSavingId !== "new") {
                          e.preventDefault();
                          handleAddStage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="vac-stage-add-btn"
                      onClick={handleAddStage}
                      disabled={!newStageName.trim() || stageSavingId === "new"}
                    >
                      {stageSavingId === "new" ? "Adding..." : "+"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {formError && <p className="vac-error">{formError}</p>}

            <div className="vac-modal-actions">
              <button className="vac-cancel-btn" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="vac-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveToast && (
        <Toast
          message="Saved. Add interview rounds and a panel below, or skip and set them up later."
          duration={0}
          dismissible
          onClose={() => setSaveToast(false)}
        />
      )}
    </div>
  );
}
