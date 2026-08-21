import { useEffect, useState } from "react";
import { listVacancies, createVacancy, updateVacancy, type Vacancy, type VacancyInput } from "../../api/vacancy";
import "./VacanciesPage.css";

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

type FormState = VacancyInput;

const EMPTY_FORM: FormState = { title: "", department: "", description: "", requirements: "", preferredSkills: "" };

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
    setForm({ ...EMPTY_FORM, department: selectedDepartment ?? "" });
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(v: Vacancy) {
    setEditingId(v.id);
    setForm({
      title: v.title,
      department: v.department,
      description: v.description,
      requirements: v.requirements ?? "",
      preferredSkills: v.preferredSkills ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.department.trim() || !form.description.trim()) {
      setFormError("Title, department, and description are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await updateVacancy(editingId, form);
      } else {
        await createVacancy(form);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save vacancy");
    } finally {
      setSaving(false);
    }
  }

  const departmentVacancies = vacancies.filter((v) => v.department === selectedDepartment);

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
              <button className="vac-back" onClick={() => setSelectedDepartment(null)}>&larr; Departments</button>
              <h1 className="vac-title">{selectedDepartment}</h1>
            </div>
            <button className="vac-create-btn" onClick={openCreateForm}>Create Vacancy</button>
          </div>
          <div className="vac-divider" />
          {loading && <p className="vac-muted">Loading...</p>}
          {error && <p className="vac-error">{error}</p>}
          {!loading && departmentVacancies.length === 0 && (
            <p className="vac-muted">No vacancies in this department yet.</p>
          )}
          <div className="vac-list">
            {departmentVacancies.map((v) => (
              <div key={v.id} className="vac-row" data-testid="vac-row">
                <span className="vac-row-title">{v.title}</span>
                <button className="vac-edit-btn" onClick={() => openEditForm(v)} aria-label="Edit vacancy">
                  &#9998;
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <div className="vac-modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="vac-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? "Edit Vacancy" : "Create Vacancy"}</h2>

            <label htmlFor="vac-title-input">Title</label>
            <input id="vac-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

            <label htmlFor="vac-department-select">Department</label>
            <select id="vac-department-select" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select a department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <label htmlFor="vac-description-input">Description</label>
            <textarea id="vac-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />

            <label htmlFor="vac-requirements-input">Requirements</label>
            <textarea id="vac-requirements-input" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={2} />

            <label htmlFor="vac-skills-input">Preferred Skills</label>
            <textarea id="vac-skills-input" value={form.preferredSkills} onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })} rows={2} />

            {formError && <p className="vac-error">{formError}</p>}

            <div className="vac-modal-actions">
              <button className="vac-cancel-btn" onClick={() => setFormOpen(false)}>Cancel</button>
              <button className="vac-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
