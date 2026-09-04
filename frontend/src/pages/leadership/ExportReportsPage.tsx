import { useEffect, useState } from "react";
import { listLeadershipReports, fetchLeadershipReportPdfUrl, type LeadershipReportType } from "../../api/leadership";
import "./ExportReportsPage.css";

export default function ExportReportsPage() {
  const [reports, setReports] = useState<{ type: LeadershipReportType; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyType, setBusyType] = useState<LeadershipReportType | null>(null);

  useEffect(() => {
    listLeadershipReports()
      .then((res) => setReports(res.reports))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load reports"))
      .finally(() => setLoading(false));
  }, []);

  async function handleView(type: LeadershipReportType) {
    setBusyType(type);
    setError("");
    try {
      const url = await fetchLeadershipReportPdfUrl(type);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open report");
    } finally {
      setBusyType(null);
    }
  }

  async function handleExport(type: LeadershipReportType) {
    setBusyType(type);
    setError("");
    try {
      const url = await fetchLeadershipReportPdfUrl(type);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export report");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="er-page">
      <h1 className="er-title">Export Reports</h1>
      <div className="er-divider" />

      {loading && <p className="er-muted">Loading...</p>}
      {error && <p className="er-error">{error}</p>}

      {!loading && (
        <div className="er-list">
          {reports.map((r) => (
            <div key={r.type} className="er-row">
              <span className="er-row-name">{r.name}</span>
              <div className="er-row-actions">
                <button className="er-btn" onClick={() => handleView(r.type)} disabled={busyType === r.type}>View Report</button>
                <button className="er-btn er-btn-primary" onClick={() => handleExport(r.type)} disabled={busyType === r.type}>Export</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
