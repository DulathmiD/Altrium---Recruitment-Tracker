import { useEffect, useState } from "react";
import { getSystemMetrics, runBackupNow, type SystemMetrics } from "../../api/system";
import "./SystemPage.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Same role-label vocabulary as UsersPage.tsx -- duplicated locally rather
// than shared, consistent with this project's existing per-page-utility
// convention (see e.g. relativeTime, defined separately in both
// CandidatesPage.tsx and here).
const ROLE_LABELS: Record<string, string> = {
  HR: "HR",
  INTERVIEWER: "Interviewer",
  MANAGEMENT: "Management",
  HIRING_MANAGER: "Hiring Manager",
  IT_ADMIN: "IT Admin",
  LEADERSHIP_MANAGEMENT: "Leadership Management",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function SystemPage() {
  const [data, setData] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");

  function loadMetrics() {
    return getSystemMetrics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load system metrics"));
  }

  useEffect(() => {
    loadMetrics().finally(() => setLoading(false));
  }, []);

  async function handleRunBackupNow() {
    setBackupRunning(true);
    setBackupMessage("");
    try {
      // No success message shown here on purpose -- the "Last backup: ..."
      // banner and the history table below already update via loadMetrics()
      // to reflect the new backup, so a separate "Backup complete: ..."
      // line was redundant clutter. Failures still surface a message below,
      // since that's the one case where the rest of the page doesn't change.
      await runBackupNow();
      await loadMetrics();
    } catch (err) {
      setBackupMessage(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBackupRunning(false);
    }
  }

  return (
    <div className="sys-page">
      <h1 className="sys-title">System Monitoring</h1>
      <div className="sys-divider" />

      {loading && <p className="sys-muted">Loading...</p>}
      {error && <p className="sys-error">{error}</p>}

      {data && (
        <div className="sys-content">
          <div className="sys-kpi-grid">
            <div className="sys-kpi-tile sys-kpi-tile--blue">
              <div className="sys-kpi-label">Server Load</div>
              <div className="sys-kpi-value">{data.serverLoadPercent}%</div>
            </div>
            <div className="sys-kpi-tile sys-kpi-tile--gold">
              <div className="sys-kpi-label">Response Time</div>
              <div className="sys-kpi-value">{data.responseTimeMs !== null ? `${data.responseTimeMs}ms` : "—"}</div>
            </div>
            <div className="sys-kpi-tile sys-kpi-tile--green">
              <div className="sys-kpi-label">Concurrent Users</div>
              <div className="sys-kpi-value">{data.concurrentUsers}</div>
            </div>
          </div>

          <h2 className="sys-section-title">Active Users</h2>
          {data.activeUsers.length === 0 ? (
            <p className="sys-muted" style={{ marginBottom: 24 }}>No users active in the last 10 minutes.</p>
          ) : (
            <table className="sys-backup-table" style={{ marginBottom: 24 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {data.activeUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td>{u.lastActiveAt ? relativeTime(u.lastActiveAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="sys-section-title">Backups</h2>
          <div className="sys-backup-box" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span>
              {data.backups.lastBackupAt
                ? `Last backup: ${new Date(data.backups.lastBackupAt).toLocaleString()} - Successful`
                : "No backups have run yet."}
            </span>
            <button type="button" className="sys-btn" onClick={handleRunBackupNow} disabled={backupRunning}>
              {backupRunning ? "Running..." : "Run Backup Now"}
            </button>
          </div>
          {backupMessage && <p className="sys-muted" style={{ margin: "8px 0 0" }}>{backupMessage}</p>}

          {data.backups.history.length === 0 ? (
            <p className="sys-muted" style={{ marginTop: 16 }}>
              No backup files yet. Scheduled to run automatically once a day, or click "Run Backup Now" above.
            </p>
          ) : (
            <table className="sys-backup-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>File</th>
                  <th>Size</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.backups.history.map((h) => (
                  <tr key={h.filename}>
                    <td>{new Date(h.at).toLocaleString()}</td>
                    <td>{h.filename}</td>
                    <td>{formatBytes(h.sizeBytes)}</td>
                    <td>
                      <span className={"sys-backup-status " + (h.status === "successful" ? "ok" : "fail")}>
                        {h.status === "successful" ? "Successful" : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
