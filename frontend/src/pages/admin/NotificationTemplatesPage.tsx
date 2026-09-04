import { useEffect, useState } from "react";
import {
  listNotificationTemplates,
  updateNotificationTemplate,
  resetNotificationTemplate,
  type NotificationTemplate,
} from "../../api/notificationTemplates";
import Toast from "../../components/Toast";
import "./NotificationTemplatesPage.css";

// Backend labels are lowercase sentence-case (e.g. "Interview scheduled -
// panelist notice") since that's also fine for audit-log text elsewhere.
// Title-case them just for display here.
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// SCRUM2-45. Read + edit only -- keys are a fixed backend-defined set (see
// backend/src/utils/notificationTemplates.ts), so there's no "create" here.
export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listNotificationTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load notification templates"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openEdit(t: NotificationTemplate) {
    setEditing(t);
    setSubjectDraft(t.subject);
    setBodyDraft(t.body);
    setSaveError("");
  }

  async function handleSave() {
    if (!editing) return;
    if (!subjectDraft.trim() || !bodyDraft.trim()) {
      setSaveError("Subject and body are both required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await updateNotificationTemplate(editing.key, subjectDraft.trim(), bodyDraft.trim());
      setEditing(null);
      setToast(`Saved "${editing.label}".`);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save this template");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!editing) return;
    setSaving(true);
    setSaveError("");
    try {
      const reset = await resetNotificationTemplate(editing.key);
      setSubjectDraft(reset.subject);
      setBodyDraft(reset.body);
      setToast(`Reset "${editing.label}" to its default text.`);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not reset this template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tmpl-page">
      <h1 className="tmpl-title">Notification Templates</h1>
      <div className="tmpl-divider" />

      {loading && <p className="tmpl-muted">Loading...</p>}
      {error && <p className="tmpl-error">{error}</p>}

      {!loading && !error && (
        <div className="tmpl-list">
          {templates.map((t) => (
            <div key={t.key} className="tmpl-row">
              <div className="tmpl-row-main">
                <div className="tmpl-row-label">
                  {titleCase(t.label)}
                  {t.isDefault && <span className="tmpl-default-badge">Default</span>}
                </div>
              </div>
              <button className="tmpl-edit-btn" onClick={() => openEdit(t)}>Edit</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="tmpl-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="tmpl-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{titleCase(editing.label)}</h2>

            <label htmlFor="tmpl-subject-input">Subject</label>
            <input id="tmpl-subject-input" value={subjectDraft} onChange={(e) => setSubjectDraft(e.target.value)} />

            <label htmlFor="tmpl-body-input">Body</label>
            <textarea id="tmpl-body-input" rows={8} value={bodyDraft} onChange={(e) => setBodyDraft(e.target.value)} />

            <p className="tmpl-placeholder-hint">
              Available placeholders: {editing.placeholders.map((p) => `{{${p}}}`).join(", ")}
            </p>

            {saveError && <p className="tmpl-error">{saveError}</p>}

            <div className="tmpl-modal-actions">
              <button className="tmpl-reset-btn" onClick={handleReset} disabled={saving || editing.isDefault}>
                Reset to default
              </button>
              <div className="tmpl-modal-actions-right">
                <button className="tmpl-cancel-btn" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                <button className="tmpl-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} duration={5000} dismissible onClose={() => setToast(null)} />}
    </div>
  );
}
