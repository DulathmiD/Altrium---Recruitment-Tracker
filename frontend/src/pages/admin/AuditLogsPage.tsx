import { useEffect, useState } from "react";
import { listAuditLogs, listAuditEventTypes, type AuditLog } from "../../api/auditLogs";
import "./AuditLogsPage.css";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ eventType, from, to });

  useEffect(() => {
    listAuditEventTypes().then((res) => setEventTypes(res.eventTypes));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    listAuditLogs({
      eventType: applied.eventType || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
    })
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load audit logs"))
      .finally(() => setLoading(false));
  }, [applied]);

  return (
    <div className="aud-page">
      <h1 className="aud-title">Audit Logs</h1>
      <div className="aud-divider" />

      <div className="aud-filter-bar">
        <div className="aud-filter-field">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="aud-filter-field">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="aud-filter-field">
          <label>Event Type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All event types</option>
            {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button className="aud-apply-btn" onClick={() => setApplied({ eventType, from, to })}>Apply</button>
      </div>

      {loading && <p className="aud-muted">Loading...</p>}
      {error && <p className="aud-error">{error}</p>}
      {!loading && logs.length === 0 && <p className="aud-muted">No audit log entries match these filters.</p>}

      {!loading && logs.length > 0 && (
        <table className="aud-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Event Type</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.name ?? "System"}</td>
                <td className="aud-action-text">{log.description}</td>
                <td>{log.eventType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
