import { useEffect, useState } from "react";
import { listManagementReports, fetchManagementReportPdfUrl, type ReportType } from "../../api/management";
import "./ReportsPage.css";

export default function ReportsPage() {
  const [hasDepartment, setHasDepartment] = useState(true);
  const [reports, setReports] = useState<{ type: ReportType; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyType, setBusyType] = useState<ReportType | null>(null);

  useEffect(() => {
    listManagementReports()
      .then((res) => {
        if (!res.hasDepartment) {
          setHasDepartment(false);
          return;
        }
        setReports(res.reports);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load reports"))
      .finally(() => setLoading(false));
  }, []);

  async function handleView(type: ReportType) {
    setBusyType(type);
    setError("");
    try {
      const url = await fetchManagementReportPdfUrl(type);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open report");
    } finally {
      setBusyType(null);
    }
  }

  async function handleExport(type: ReportType) {
    setBusyType(type);
    setError("");
    try {
      const url = await fetchManagementReportPdfUrl(type);
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
    <div className="mr-page">
      <h1 className="mr-title">Management Reports</h1>
      <div className="mr-divider" />

      {!hasDepartment && (
        <p className="mr-muted">No department is set on your account, so there's nothing to scope reports to yet -- ask IT Admin to set your department.</p>
      )}
      {loading && <p className="mr-muted">Loading...</p>}
      {error && <p className="mr-error">{error}</p>}

      {hasDepartment && !loading && (
        <div className="mr-list">
          {reports.map((r) => (
            <div key={r.type} className="mr-row">
              <span className="mr-row-name">{r.name}</span>
              <div className="mr-row-actions">
                <button className="mr-btn" onClick={() => handleView(r.type)} disabled={busyType === r.type}>View Report</button>
                <button className="mr-btn mr-btn-primary" onClick={() => handleExport(r.type)} disabled={busyType === r.type}>Export</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
