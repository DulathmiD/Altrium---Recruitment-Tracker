import { useEffect, useState } from "react";
import {
  listFollowUps,
  sendFeedbackReminder,
  buildReminderTemplate,
  sendCandidateInvite,
  buildInviteTemplate,
  sendPanelistInterviewInvite,
  buildPanelistInviteTemplate,
  type FollowUps,
  type PendingFeedbackRow,
  type PendingInviteRow,
  type PendingPanelistInviteRow,
} from "../../api/followUps";
import Toast from "../../components/Toast";
import "./FollowUpsPage.css";

type ReminderTarget = { row: PendingFeedbackRow; userId: number; name: string };
type PanelistInviteTarget = { row: PendingPanelistInviteRow; userId: number; name: string };

export default function FollowUpsPage() {
  const [data, setData] = useState<FollowUps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [dismissedPendingFeedback, setDismissedPendingFeedback] = useState<Set<string>>(new Set());

  const [inviteTarget, setInviteTarget] = useState<PendingInviteRow | null>(null);
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invSending, setInvSending] = useState(false);
  const [invSendError, setInvSendError] = useState("");
  const [dismissedInvites, setDismissedInvites] = useState<Set<number>>(new Set());

  const [panelistInviteTarget, setPanelistInviteTarget] = useState<PanelistInviteTarget | null>(null);
  const [panelistInviteSubject, setPanelistInviteSubject] = useState("");
  const [panelistInviteMessage, setPanelistInviteMessage] = useState("");
  const [panelistInvSending, setPanelistInvSending] = useState(false);
  const [panelistInvSendError, setPanelistInvSendError] = useState("");
  const [dismissedPanelistInvites, setDismissedPanelistInvites] = useState<Set<string>>(new Set());

  const [openCallRow, setOpenCallRow] = useState<{ interviewId: number; candidateName: string; phoneNumber: string | null } | null>(null);
  const [dismissedCalls, setDismissedCalls] = useState<Set<number>>(new Set());

  const [toast, setToast] = useState<string | null>(null);
  function showToast(message: string) {
    setToast(message);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await listFollowUps();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load follow-ups");
    } finally {
      setLoading(false);
    }
  }

  function openReminder(row: PendingFeedbackRow, userId: number, name: string) {
    const template = buildReminderTemplate(row, name);
    setReminderTarget({ row, userId, name });
    setReminderSubject(template.subject);
    setReminderMessage(template.message);
    setSendError("");
  }

  async function handleSendReminder() {
    if (!reminderTarget) return;
    if (!reminderSubject.trim() || !reminderMessage.trim()) {
      setSendError("Subject and message are both required.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      await sendFeedbackReminder(reminderTarget.row.interviewId, reminderTarget.userId, {
        subject: reminderSubject.trim(),
        message: reminderMessage.trim(),
      });
      setDismissedPendingFeedback((prev) => new Set(prev).add(`${reminderTarget.row.interviewId}-${reminderTarget.userId}`));
      showToast(`Email sent to ${reminderTarget.name}.`);
      setReminderTarget(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send reminder");
    } finally {
      setSending(false);
    }
  }

  function openInvite(row: PendingInviteRow) {
    const template = buildInviteTemplate(row);
    setInviteTarget(row);
    setInviteSubject(template.subject);
    setInviteMessage(template.message);
    setInvSendError("");
  }

  async function handleSendInvite() {
    if (!inviteTarget) return;
    if (!inviteSubject.trim() || !inviteMessage.trim()) {
      setInvSendError("Subject and message are both required.");
      return;
    }
    setInvSending(true);
    setInvSendError("");
    try {
      await sendCandidateInvite(inviteTarget.interviewId, {
        subject: inviteSubject.trim(),
        message: inviteMessage.trim(),
      });
      setDismissedInvites((prev) => new Set(prev).add(inviteTarget.interviewId));
      showToast(`Email sent to ${inviteTarget.candidate.name}.`);
      setInviteTarget(null);
    } catch (err) {
      setInvSendError(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setInvSending(false);
    }
  }

  function openPanelistInvite(row: PendingPanelistInviteRow, userId: number, name: string) {
    const template = buildPanelistInviteTemplate(row, name);
    setPanelistInviteTarget({ row, userId, name });
    setPanelistInviteSubject(template.subject);
    setPanelistInviteMessage(template.message);
    setPanelistInvSendError("");
  }

  async function handleSendPanelistInvite() {
    if (!panelistInviteTarget) return;
    if (!panelistInviteSubject.trim() || !panelistInviteMessage.trim()) {
      setPanelistInvSendError("Subject and message are both required.");
      return;
    }
    setPanelistInvSending(true);
    setPanelistInvSendError("");
    try {
      await sendPanelistInterviewInvite(panelistInviteTarget.row.interviewId, panelistInviteTarget.userId, {
        subject: panelistInviteSubject.trim(),
        message: panelistInviteMessage.trim(),
      });
      setDismissedPanelistInvites((prev) =>
        new Set(prev).add(`${panelistInviteTarget.row.interviewId}-${panelistInviteTarget.userId}`)
      );
      showToast(`Email sent to ${panelistInviteTarget.name}.`);
      setPanelistInviteTarget(null);
    } catch (err) {
      setPanelistInvSendError(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setPanelistInvSending(false);
    }
  }

  return (
    <div className="fu-page">
      <h1 className="fu-title">Follow Ups</h1>
      <div className="fu-divider" />

      {loading && <p className="fu-muted">Loading...</p>}
      {error && <p className="fu-error">{error}</p>}

      {!loading && data && (
        <>
          <section className="fu-section">
            <h2 className="fu-section-title">Pending CV Review</h2>
            {data.pendingCvReviews.length === 0 && <p className="fu-muted">Nothing pending.</p>}
            {data.pendingCvReviews.length > 0 && (
              <table className="fu-table">
                <thead>
                  <tr>
                    <th className="fu-col3-candidate">Candidate</th>
                    <th className="fu-col3-vacancy">Vacancy</th>
                    <th className="fu-col3-applied">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingCvReviews.map((r) => (
                    <tr key={r.applicationId}>
                      <td className="fu-primary">{r.candidate.name}</td>
                      <td className="fu-col3-vacancy">{r.vacancy.title} - {r.vacancy.department}</td>
                      <td>{new Date(r.appliedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="fu-section">
            <h2 className="fu-section-title">Pending Feedback</h2>
            {(() => {
              const visibleRows = data.pendingFeedback
                .map((row) => ({
                  row,
                  pendingFrom: row.pendingFrom.filter((p) => !dismissedPendingFeedback.has(`${row.interviewId}-${p.id}`)),
                }))
                .filter(({ pendingFrom }) => pendingFrom.length > 0);

              if (visibleRows.length === 0) {
                return <p className="fu-muted">Nothing pending.</p>;
              }

              return visibleRows.map(({ row, pendingFrom }) => (
                <div key={row.interviewId} className="fu-feedback-card">
                  <div className="fu-feedback-header">
                    <div className="fu-primary">
                      {row.vacancy.title} - {row.round.name}
                      {row.round.roundLabel ? ` - ${row.round.roundLabel}` : ""} - {row.candidate.name}
                    </div>
                  </div>
                  <div className="fu-pending-list">
                    {pendingFrom.map((p) => (
                      <div key={p.id} className="fu-pending-row">
                        <span>{p.name}</span>
                        <button className="fu-action-btn" onClick={() => openReminder(row, p.id, p.name)}>
                          Send Email
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </section>

          <section className="fu-section">
            <h2 className="fu-section-title">Interview Invites - Interviewers</h2>
            {(() => {
              const visiblePanelistRows = data.pendingPanelistInvites
                .map((row) => ({
                  row,
                  pendingFrom: row.pendingFrom.filter((p) => !dismissedPanelistInvites.has(`${row.interviewId}-${p.id}`)),
                }))
                .filter(({ pendingFrom }) => pendingFrom.length > 0);

              if (visiblePanelistRows.length === 0) {
                return <p className="fu-muted">Nothing pending.</p>;
              }

              return visiblePanelistRows.map(({ row, pendingFrom }) => (
                <div key={row.interviewId} className="fu-feedback-card">
                  <div className="fu-feedback-header">
                    <div className="fu-primary">
                      {row.vacancy.title} - {row.round.name}
                      {row.round.roundLabel ? ` - ${row.round.roundLabel}` : ""} - {row.candidate.name}
                    </div>
                  </div>
                  <div className="fu-pending-list">
                    {pendingFrom.map((p) => (
                      <div key={p.id} className="fu-pending-row">
                        <span>{p.name}</span>
                        <button className="fu-action-btn" onClick={() => openPanelistInvite(row, p.id, p.name)}>
                          Send Email
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </section>

          <section className="fu-section">
            <h2 className="fu-section-title">Interview Invites - Candidates</h2>
            {(() => {
              const visibleInvites = data.pendingInvites.filter((r) => !dismissedInvites.has(r.interviewId));
              if (visibleInvites.length === 0) {
                return <p className="fu-muted">Nothing pending.</p>;
              }
              return (
                <table className="fu-table">
                  <thead>
                    <tr>
                      <th className="fu-col-candidate">Candidate</th>
                      <th className="fu-col-vacancy">Vacancy</th>
                      <th className="fu-col-stage">Stage</th>
                      <th className="fu-col-scheduled">Scheduled</th>
                      <th className="fu-col-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInvites.map((r) => (
                      <tr key={r.interviewId}>
                        <td className="fu-primary">{r.candidate.name}</td>
                        <td>{r.vacancy.title}</td>
                        <td>
                          {r.round.order}. {r.round.name}
                          {r.round.roundLabel ? ` - ${r.round.roundLabel}` : ""}
                        </td>
                        <td>{new Date(r.scheduledAt).toLocaleString()}</td>
                        <td className="fu-call-cell">
                          <button className="fu-action-btn" onClick={() => openInvite(r)}>
                            Send Email
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </section>

          <section className="fu-section">
            <h2 className="fu-section-title">Calls</h2>
            {(() => {
              const visibleCalls = data.upcomingCalls.filter((r) => !dismissedCalls.has(r.interviewId));
              if (visibleCalls.length === 0) {
                return <p className="fu-muted">Nothing upcoming.</p>;
              }
              return (
                <table className="fu-table">
                  <thead>
                    <tr>
                      <th className="fu-col-candidate">Candidate</th>
                      <th className="fu-col-vacancy">Vacancy</th>
                      <th className="fu-col-stage">Stage</th>
                      <th className="fu-col-scheduled">Scheduled</th>
                      <th className="fu-col-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCalls.map((r) => (
                      <tr key={r.interviewId}>
                        <td className="fu-primary">{r.candidate.name}</td>
                        <td>{r.vacancy.title}</td>
                        <td>{r.round.order}. {r.round.name}</td>
                        <td>{new Date(r.scheduledAt).toLocaleString()}</td>
                        <td className="fu-call-cell">
                          <button
                            className="fu-action-btn"
                            onClick={() =>
                              setOpenCallRow({
                                interviewId: r.interviewId,
                                candidateName: r.candidate.name,
                                phoneNumber: r.candidate.phoneNumber,
                              })
                            }
                          >
                            Call
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </section>
        </>
      )}

      {reminderTarget && (
        <div className="fu-modal-backdrop" onClick={() => setReminderTarget(null)}>
          <div className="fu-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Send Reminder</h2>
            <p className="fu-muted">To: {reminderTarget.name}</p>

            <label htmlFor="fu-subject-input">Subject</label>
            <input id="fu-subject-input" value={reminderSubject} onChange={(e) => setReminderSubject(e.target.value)} />

            <label htmlFor="fu-message-input">Message</label>
            <textarea
              id="fu-message-input"
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              rows={8}
            />

            {sendError && <p className="fu-error">{sendError}</p>}

            <div className="fu-modal-actions">
              <button className="fu-cancel-btn" onClick={() => setReminderTarget(null)}>Cancel</button>
              <button className="fu-save-btn" onClick={handleSendReminder} disabled={sending}>
                {sending ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteTarget && (
        <div className="fu-modal-backdrop" onClick={() => setInviteTarget(null)}>
          <div className="fu-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Send Interview Invite</h2>
            <p className="fu-muted">To: {inviteTarget.candidate.name}</p>

            <label htmlFor="fu-invite-subject-input">Subject</label>
            <input id="fu-invite-subject-input" value={inviteSubject} onChange={(e) => setInviteSubject(e.target.value)} />

            <label htmlFor="fu-invite-message-input">Message</label>
            <textarea
              id="fu-invite-message-input"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={8}
            />

            {invSendError && <p className="fu-error">{invSendError}</p>}

            <div className="fu-modal-actions">
              <button className="fu-cancel-btn" onClick={() => setInviteTarget(null)}>Cancel</button>
              <button className="fu-save-btn" onClick={handleSendInvite} disabled={invSending}>
                {invSending ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {panelistInviteTarget && (
        <div className="fu-modal-backdrop" onClick={() => setPanelistInviteTarget(null)}>
          <div className="fu-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Send Interview Invite</h2>
            <p className="fu-muted">To: {panelistInviteTarget.name}</p>

            <label htmlFor="fu-panelist-invite-subject-input">Subject</label>
            <input
              id="fu-panelist-invite-subject-input"
              value={panelistInviteSubject}
              onChange={(e) => setPanelistInviteSubject(e.target.value)}
            />

            <label htmlFor="fu-panelist-invite-message-input">Message</label>
            <textarea
              id="fu-panelist-invite-message-input"
              value={panelistInviteMessage}
              onChange={(e) => setPanelistInviteMessage(e.target.value)}
              rows={8}
            />

            {panelistInvSendError && <p className="fu-error">{panelistInvSendError}</p>}

            <div className="fu-modal-actions">
              <button className="fu-cancel-btn" onClick={() => setPanelistInviteTarget(null)}>Cancel</button>
              <button className="fu-save-btn" onClick={handleSendPanelistInvite} disabled={panelistInvSending}>
                {panelistInvSending ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openCallRow && (
        <div className="fu-modal-backdrop" onClick={() => setOpenCallRow(null)}>
          <div className="fu-call-modal" onClick={(e) => e.stopPropagation()}>
            <p className="fu-muted">{openCallRow.candidateName}</p>
            {openCallRow.phoneNumber ? (
              <p className="fu-call-modal-number">{openCallRow.phoneNumber}</p>
            ) : (
              <p className="fu-call-modal-none">No phone number on file.</p>
            )}
            <div className="fu-modal-actions">
              <button className="fu-cancel-btn" onClick={() => setOpenCallRow(null)}>Cancel</button>
              <button
                className="fu-save-btn"
                onClick={() => {
                  setDismissedCalls((prev) => new Set(prev).add(openCallRow.interviewId));
                  showToast(`Call with ${openCallRow.candidateName} marked as done.`);
                  setOpenCallRow(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} duration={4000} onClose={() => setToast(null)} />}
    </div>
  );
}
