import { useEffect, useState } from "react";
import { getSystemMetrics, type SystemMetrics } from "../../api/system";
import "./SystemPage.css";

export default function SystemPage() {
  const [data, setData] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getSystemMetrics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load system metrics"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="sys-page">
      <h1 className="sys-title">System Monitoring</h1>
      <div className="sys-divider" />

      {loading && <p className="sys-muted">Loading...</p>}
      {error && <p className="sys-error">{error}</p>}

      {data && (
        <div className="sys-content">
          <div className="sys-kpi-grid">
            <div className="sys-kpi-tile">
              <div className="sys-kpi-label">Server Load</div>
              <div className="sys-kpi-value">{data.serverLoadPercent}%</div>
            </div>
            <div className="sys-kpi-tile">
              <div className="sys-kpi-label">Response Time</div>
              <div className="sys-kpi-value">{data.responseTimeMs !== null ? `${data.responseTimeMs}ms` : "—"}</div>
            </div>
            <div className="sys-kpi-tile">
              <div className="sys-kpi-label">Concurrent Users</div>
              <div className="sys-kpi-value">{data.concurrentUsers}</div>
            </div>
          </div>

          <h2 className="sys-section-title">Backups</h2>
          <div className="sys-backup-box">
            Last automatic backup: {data.backups.lastBackupAt ? new Date(data.backups.lastBackupAt).toLocaleString() : "unknown"} - Successful
          </div>

          <table className="sys-backup-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.backups.history.map((h) => (
                <tr key={h.at}>
                  <td>{new Date(h.at).toLocaleString()}</td>
                  <td>
                    <span className={"sys-backup-status " + (h.status === "successful" ? "ok" : "fail")}>
                      {h.status === "successful" ? "Successful" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
