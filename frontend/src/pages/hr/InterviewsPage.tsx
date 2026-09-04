import { useEffect, useMemo, useState } from "react";
import {
  listInterviewSlots,
  createInterviewSlotOnly,
  getInterviewSlotDetail,
  addCandidatesToInterviewSlot,
  interviewSlotLabel,
  type InterviewSlotSummary,
  type InterviewSlotDetail,
  type AddCandidatesResult,
} from "../../api/interviews";
import { listVacancies, type Vacancy } from "../../api/vacancy";
import { listVacancyStages, type VacancyStage } from "../../api/vacancyStages";
import { listVacancyInterviewers, assignInterviewerToVacancy, type VacancyInterviewer } from "../../api/vacancyInterviewers";
import { listAssignableStaff, roleLabel, type StaffMember } from "../../api/staff";
import { listCandidates, type CandidateApplicationRow } from "../../api/candidates";
import Toast from "../../components/Toast";
import { formatSlotTimeRange } from "../../utils/interviewTime";
import "./InterviewsPage.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local (not UTC) YYYY-MM-DD -- Date.toISOString() shifts to UTC first, which
// can land on the wrong calendar day depending on the browser's timezone.
function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ModalKind = "panel" | "schedule" | "addCandidate" | null;

export default function InterviewsPage() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [slots, setSlots] = useState<InterviewSlotSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [slotDetail, setSlotDetail] = useState<InterviewSlotDetail | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState<string | null>(null);

  const monthStart = useMemo(() => {
    const d = new Date(monthCursor);
    d.setDate(1);
    return d;
  }, [monthCursor]);
  const monthEnd = useMemo(() => {
    const d = new Date(monthCursor);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  }, [monthCursor]);

  async function refreshSlots() {
    try {
      const data = await listInterviewSlots({ from: localYmd(monthStart), to: `${localYmd(monthEnd)}T23:59:59` });
      setSlots(data);
    } catch {
      setSlots([]);
    }
  }

  useEffect(() => {
    refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  useEffect(() => {
    if (!selectedSlotId) {
      setSlotDetail(null);
      return;
    }
    getInterviewSlotDetail(selectedSlotId)
      .then(setSlotDetail)
      .catch(() => setSlotDetail(null));
  }, [selectedSlotId]);

  // Esc backs out one level at a time: modal -> "+" menu -> slot detail ->
  // day panel -> calendar-only, per the wireframe ("if HR presses esc the
  // sidebar should disappear and go back to the interviews landing page
  // which is only the calendar showing").
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (modal) {
        setModal(null);
      } else if (plusMenuOpen) {
        setPlusMenuOpen(false);
      } else if (selectedSlotId) {
        setSelectedSlotId(null);
      } else if (selectedDate) {
        setSelectedDate(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, plusMenuOpen, selectedSlotId, selectedDate]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, InterviewSlotSummary[]>();
    for (const s of slots) {
      const key = localYmd(new Date(s.scheduledAt));
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [slots]);

  const gridCells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    return cells;
  }, [monthStart, monthEnd]);

  function closeAllPanels() {
    setSelectedDate(null);
    setSelectedSlotId(null);
  }

  function handleModalDone(message: string) {
    setModal(null);
    setToast(message);
    refreshSlots();
  }

  return (
    <div className="ivw-page">
      <div className="ivw-header-row">
        <h1 className="ivw-title">Interviews</h1>
        <button className="ivw-plus-btn" onClick={() => setPlusMenuOpen(true)} aria-label="Add">
          +
        </button>
      </div>
      <div className="ivw-divider" />

      <div className="ivw-body">
        <div className={`ivw-calendar-wrap${selectedDate ? " ivw-calendar-shrunk" : ""}`}>
          <div className="ivw-calendar-nav">
            <button
              type="button"
              onClick={() =>
                setMonthCursor((d) => {
                  const n = new Date(d);
                  n.setMonth(n.getMonth() - 1);
                  return n;
                })
              }
            >
              &#8249;
            </button>
            <span>{monthStart.toLocaleString("en-GB", { month: "long", year: "numeric" })}</span>
            <button
              type="button"
              onClick={() =>
                setMonthCursor((d) => {
                  const n = new Date(d);
                  n.setMonth(n.getMonth() + 1);
                  return n;
                })
              }
            >
              &#8250;
            </button>
          </div>
          <div className="ivw-calendar-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="ivw-calendar-weekday">
                {w}
              </div>
            ))}
            {gridCells.map((d, i) => {
              if (!d) return <div key={`blank-${i}`} className="ivw-calendar-cell ivw-calendar-cell-empty" />;
              const key = localYmd(d);
              const daySlots = slotsByDate.get(key) ?? [];
              const hasInterviews = daySlots.length > 0;
              return (
                <button
                  key={key}
                  type="button"
                  className={`ivw-calendar-cell${hasInterviews ? " ivw-calendar-cell-active" : ""}${
                    selectedDate === key ? " ivw-calendar-cell-selected" : ""
                  }`}
                  onClick={() => (hasInterviews ? setSelectedDate(key) : undefined)}
                  disabled={!hasInterviews}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && !selectedSlotId && (
          <div className="ivw-side-panel">
            <div className="ivw-side-panel-header">
              <h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
              <button type="button" className="ivw-side-panel-close" onClick={closeAllPanels} aria-label="Close">
                &#10005;
              </button>
            </div>
            <div className="ivw-slot-list">
              {(slotsByDate.get(selectedDate) ?? []).map((s) => (
                <button key={s.id} type="button" className="ivw-slot-row" onClick={() => setSelectedSlotId(s.id)}>
                  <span className="ivw-slot-time">{formatSlotTimeRange(s.scheduledAt)}</span>
                  <span className="ivw-slot-label">{interviewSlotLabel(s)}</span>
                  <span className="ivw-slot-count">{s.candidateCount} candidate(s)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSlotId && slotDetail && (
          <div className="ivw-side-panel">
            <div className="ivw-side-panel-header">
              <h2>{interviewSlotLabel(slotDetail)}</h2>
              <button type="button" className="ivw-side-panel-close" onClick={() => setSelectedSlotId(null)} aria-label="Close">
                &#10005;
              </button>
            </div>
            <p className="ivw-muted">{new Date(slotDetail.scheduledAt).toLocaleString()}</p>

            <h3 className="ivw-section-heading">Panel</h3>
            <ul className="ivw-plain-list">
              {slotDetail.panelists.length === 0 && <li className="ivw-muted">No panelists assigned.</li>}
              {slotDetail.panelists.map((p) => (
                <li key={p.id}>{p.user.name}</li>
              ))}
            </ul>

            <h3 className="ivw-section-heading">Candidates</h3>
            <ul className="ivw-plain-list">
              {slotDetail.interviews.length === 0 && <li className="ivw-muted">No candidates added yet.</li>}
              {slotDetail.interviews.map((iv) => (
                <li key={iv.id}>
                  {iv.application.candidate.name}
                  {iv.feedback.length > 0 ? ` - ${iv.feedback.length} feedback submitted` : " - awaiting feedback"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {plusMenuOpen && (
        <div className="ivw-modal-backdrop" onClick={() => setPlusMenuOpen(false)}>
          <div className="ivw-plus-menu" onClick={(e) => e.stopPropagation()}>
            {/* Clicking the backdrop already closed this, but that wasn't
                obvious from the menu alone (corrections doc) -- an explicit
                X gives an on-screen way out, same pattern as the other
                modals in this file (ivw-modal-close). */}
            <button
              type="button"
              className="ivw-modal-close ivw-plus-menu-close"
              onClick={() => setPlusMenuOpen(false)}
              aria-label="Close"
            >
              &#10005;
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setModal("panel");
              }}
            >
              Assign Interview Panel
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setModal("schedule");
              }}
            >
              Schedule Interview
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setModal("addCandidate");
              }}
            >
              Add Candidate(s) to Interview
            </button>
          </div>
        </div>
      )}

      {modal === "panel" && (
        <AssignPanelModal onClose={() => setModal(null)} onDone={() => handleModalDone("Panel saved.")} />
      )}
      {modal === "schedule" && (
        <ScheduleInterviewModal onClose={() => setModal(null)} onDone={() => handleModalDone("Interview scheduled.")} />
      )}
      {modal === "addCandidate" && (
        <AddCandidateModal onClose={() => setModal(null)} onDone={() => handleModalDone("Candidate(s) added.")} />
      )}

      {toast && <Toast message={toast} duration={6000} dismissible onClose={() => setToast(null)} />}
    </div>
  );
}

function AssignPanelModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacancyId, setVacancyId] = useState<number | "">("");
  const [pool, setPool] = useState<VacancyInterviewer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listVacancies().then(setVacancies).catch(() => {});
    listAssignableStaff().then(setStaff).catch(() => {});
  }, []);

  useEffect(() => {
    setSelected(new Set());
    if (!vacancyId) {
      setPool([]);
      return;
    }
    listVacancyInterviewers(vacancyId).then(setPool).catch(() => {});
  }, [vacancyId]);

  const poolUserIds = useMemo(() => new Set(pool.map((p) => p.userId)), [pool]);

  async function handleSave() {
    if (!vacancyId) {
      setError("Select a vacancy.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one staff member to add.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      for (const userId of selected) {
        await assignInterviewerToVacancy(vacancyId, userId);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save panel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ivw-modal-backdrop" onClick={onClose}>
      <div className="ivw-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Assign Interview Panel</h2>
        {error && <p className="ivw-error">{error}</p>}

        <label>Vacancy</label>
        <select value={vacancyId} onChange={(e) => setVacancyId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Select a vacancy</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} - {v.department}
            </option>
          ))}
        </select>

        {vacancyId !== "" && (
          <>
            <label>Panel</label>
            <div className="ivw-checklist">
              {staff.length === 0 && <p className="ivw-muted">No assignable interviewers found.</p>}
              {staff.map((s) => {
                const already = poolUserIds.has(s.id);
                return (
                  <label key={s.id} className="ivw-check-row">
                    <input
                      type="checkbox"
                      disabled={already}
                      checked={already || selected.has(s.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        });
                      }}
                    />
                    <span>
                      {s.name} - {roleLabel(s.role)}
                      {already ? " - already on panel" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div className="ivw-modal-actions">
          <button type="button" className="ivw-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ivw-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Panel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Interviewers can only be scheduled 9:00 AM-5:00 PM, per the corrections
// doc -- each entry's hour24 already bakes in the right AM/PM, so there's no
// separate AM/PM toggle to get into an invalid combination with.
const HOUR_CHOICES: { hour24: number; display: string }[] = [
  { hour24: 9, display: "9 AM" },
  { hour24: 10, display: "10 AM" },
  { hour24: 11, display: "11 AM" },
  { hour24: 12, display: "12 PM" },
  { hour24: 13, display: "1 PM" },
  { hour24: 14, display: "2 PM" },
  { hour24: 15, display: "3 PM" },
  { hour24: 16, display: "4 PM" },
  { hour24: 17, display: "5 PM" },
];
const MINUTE_CHOICES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function ScheduleInterviewModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacancyId, setVacancyId] = useState<number | "">("");
  const [stages, setStages] = useState<VacancyStage[]>([]);
  const [vacancyStageId, setVacancyStageId] = useState<number | "">("");
  const [roundLabel, setRoundLabel] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState<number | "">("");
  const [minute, setMinute] = useState("");
  const time = hour !== "" && minute !== "" ? `${String(hour).padStart(2, "0")}:${minute}` : "";
  const [pool, setPool] = useState<VacancyInterviewer[]>([]);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listVacancies().then(setVacancies).catch(() => {});
  }, []);

  useEffect(() => {
    setVacancyStageId("");
    setPanelExpanded(false);
    if (!vacancyId) {
      setStages([]);
      setPool([]);
      return;
    }
    listVacancyStages(vacancyId)
      .then((r) => setStages(r.stages))
      .catch(() => {});
    listVacancyInterviewers(vacancyId).then(setPool).catch(() => {});
  }, [vacancyId]);

  async function handleSave() {
    if (!vacancyStageId || !date || !time) {
      setError("Stage, date, and time are required.");
      return;
    }
    if (pool.length === 0) {
      setError('This vacancy has no panel yet -- use "Assign Interview Panel" first.');
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createInterviewSlotOnly({
        vacancyStageId,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        panelistUserIds: pool.map((p) => p.userId),
        roundLabel: roundLabel.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule interview");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ivw-modal-backdrop" onClick={onClose}>
      <div className="ivw-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ivw-modal-close" onClick={onClose} aria-label="Close">
          &#10005;
        </button>
        <h2>Schedule Interview</h2>
        {error && <p className="ivw-error">{error}</p>}

        <label>Vacancy</label>
        <select value={vacancyId} onChange={(e) => setVacancyId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Select a vacancy</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} - {v.department}
            </option>
          ))}
        </select>

        {vacancyId !== "" && (
          <>
            <label>Stage</label>
            <select value={vacancyStageId} onChange={(e) => setVacancyStageId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select a stage</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <label>Day (optional)</label>
            <input
              value={roundLabel}
              onChange={(e) => setRoundLabel(e.target.value)}
              placeholder="e.g. Day 2, After lunch"
            />

            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

            <label>Time (9:00 AM - 5:00 PM)</label>
            <div className="ivw-time-row">
              <select value={hour} onChange={(e) => setHour(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Hour</option>
                {HOUR_CHOICES.map((h) => (
                  <option key={h.hour24} value={h.hour24}>
                    {h.display}
                  </option>
                ))}
              </select>
              <select value={minute} onChange={(e) => setMinute(e.target.value)}>
                <option value="">Min</option>
                {MINUTE_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <label>Panel</label>
            {pool.length === 0 ? (
              <p className="ivw-muted">No interviewers assigned to this vacancy yet - use "Assign Interview Panel" first.</p>
            ) : (
              <div className="ivw-panel-summary">
                <button
                  type="button"
                  className="ivw-panel-summary-row"
                  onClick={() => setPanelExpanded((v) => !v)}
                  aria-expanded={panelExpanded}
                >
                  <span>
                    Panel ({pool.length} {pool.length === 1 ? "member" : "members"})
                  </span>
                  <span className="ivw-panel-summary-arrow">{panelExpanded ? "▴" : "▾"}</span>
                </button>
                {panelExpanded && (
                  <ul className="ivw-plain-list ivw-panel-summary-list">
                    {pool.map((p) => (
                      <li key={p.userId}>
                        {p.user.name} - {roleLabel(p.user.role)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        <div className="ivw-modal-actions">
          <button type="button" className="ivw-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ivw-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Scheduling..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCandidateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"pick" | "target">("pick");
  const [rows, setRows] = useState<CandidateApplicationRow[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacancyFilter, setVacancyFilter] = useState<number | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [slots, setSlots] = useState<InterviewSlotSummary[]>([]);
  const [targetSlotId, setTargetSlotId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AddCandidatesResult | null>(null);

  useEffect(() => {
    listVacancies().then(setVacancies).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      listCandidates({
        stage: "SHORTLISTED",
        vacancyId: vacancyFilter === "ALL" ? undefined : vacancyFilter,
        search: search.trim() || undefined,
      })
        .then(setRows)
        .catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [vacancyFilter, search]);

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function goToTarget() {
    listInterviewSlots().then(setSlots).catch(() => setSlots([]));
    setError("");
    setStep("target");
  }

  async function handleConfirm() {
    if (!targetSlotId) {
      setError("Select an interview.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await addCandidatesToInterviewSlot(targetSlotId, [...selected]);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add candidates");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="ivw-modal-backdrop" onClick={onClose}>
        <div className="ivw-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ivw-modal-close" onClick={onClose} aria-label="Close">
            &#10005;
          </button>
          <h2>Added</h2>
          <p>{result.added.length} candidate(s) added to this interview.</p>
          {result.failed.length > 0 && (
            <div>
              <p className="ivw-error">Could not add {result.failed.length}:</p>
              <ul className="ivw-plain-list">
                {result.failed.map((f) => (
                  <li key={f.applicationId}>{f.error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="ivw-modal-actions">
            <button type="button" className="ivw-save-btn" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ivw-modal-backdrop" onClick={onClose}>
      <div className="ivw-modal ivw-modal-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ivw-modal-close" onClick={onClose} aria-label="Close">
          &#10005;
        </button>
        {step === "pick" && (
          <>
            <h2>Add Candidate(s) to Interview</h2>
            {error && <p className="ivw-error">{error}</p>}
            <div className="ivw-filter-row">
              <input placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select
                value={vacancyFilter}
                onChange={(e) => setVacancyFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
              >
                <option value="ALL">All Vacancies</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="ivw-candidate-list">
              {rows.length === 0 && <p className="ivw-muted">No shortlisted candidates match these filters.</p>}
              {rows.map((r) => (
                <label
                  key={r.id}
                  className={`ivw-candidate-row${selected.has(r.id) ? " ivw-candidate-row-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      });
                    }}
                  />
                  <span>{r.candidate.name}</span>
                  <span className="ivw-candidate-vacancy">{r.vacancy.title}</span>
                </label>
              ))}
            </div>
            <div className="ivw-modal-actions">
              <button type="button" className="ivw-cancel-btn" onClick={toggleAll} disabled={rows.length === 0}>
                {selected.size === rows.length && rows.length > 0 ? "Deselect All" : "Select All"}
              </button>
              <button type="button" className="ivw-save-btn" onClick={goToTarget} disabled={selected.size === 0}>
                Add to Interview ({selected.size})
              </button>
            </div>
          </>
        )}

        {step === "target" && (
          <>
            <h2>Add to Interview</h2>
            {error && <p className="ivw-error">{error}</p>}
            <label>Interview</label>
            <select value={targetSlotId} onChange={(e) => setTargetSlotId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select an interview</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {interviewSlotLabel(s)} - {new Date(s.scheduledAt).toLocaleString()}
                </option>
              ))}
            </select>
            <div className="ivw-modal-actions">
              <button type="button" className="ivw-cancel-btn" onClick={() => setStep("pick")}>
                Back
              </button>
              <button type="button" className="ivw-save-btn" onClick={handleConfirm} disabled={saving}>
                {saving ? "Adding..." : "Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
