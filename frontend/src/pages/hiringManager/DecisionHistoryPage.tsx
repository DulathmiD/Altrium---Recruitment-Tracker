import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyDecisionHistory, type DecisionHistoryEntry } from "../../api/hiringManager";
import "./DecisionHistoryPage.css";

const OUTCOME_CLASS: Record<DecisionHistoryEntry["outcome"], string> = {
  Hired: "dh-outcome dh-outcome-gold",
  Proceed: "dh-outcome dh-outcome-green",
  "Do Not Proceed": "dh-outcome dh-outcome-amber",
  Rejected: "dh-outcome dh-outcome-red",
};

const BUCKET_LABEL: Record<DecisionHistoryEntry["bucket"], string> = {
  HIRED: "Hired",
  PROCEED: "Proceed / Do Not Proceed",
  REJECTED: "Rejected",
};

// Corrections doc: new tab, additive to Pending Decisions -- logs every
// Proceed/Do Not Proceed/Hire/Reject decision this HM has made, grouped
// Hired first, then Proceed/Do Not Proceed, then Rejected last. A hired
// candidate only ever appears in the Hired group (backend already excludes
// them from the others -- see getMyDecisionHistory).
//
// Follow-up correction: rows are now clickable through to
// CandidateDecisionPage so the HM can view the candidate's full profile and
// feedback history. That page already renders correctly for a decided
// application -- it shows "already been hired/rejected" (or, for a
// Proceed/Do Not Proceed row, the round the recommendation was made on) plus
// the full feedbackHistory, with awaitingDecision false so it's read-only
// (no action buttons). Deliberately NOT adding Proceed/Do Not Proceed
// buttons back onto this page: these are already-made decisions being
// viewed as a log, and letting someone silently overwrite a past decision
// from a history view (with no undo) would undermine the point of having a
// decision log in the first place -- if a decision needs to change, that
// should go through Pending Decisions' normal flow, not this page.
export default function DecisionHistoryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DecisionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyDecisionHistory()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load decision history"))
      .finally(() => setLoading(false));
  }, []);

  const groups: { bucket: DecisionHistoryEntry["bucket"]; rows: DecisionHistoryEntry[] }[] = (
    ["HIRED", "PROCEED", "REJECTED"] as const
  )
    .map((bucket) => ({ bucket, rows: rows.filter((r) => r.bucket === bucket) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="dh-page">
      <h1 className="dh-title">Decision History</h1>
      <div className="dh-divider" />

      {loading && <p className="dh-muted">Loading...</p>}
      {error && <p className="dh-error">{error}</p>}
      {!loading && rows.length === 0 && <p className="dh-muted">No decisions recorded yet.</p>}

      {!loading &&
        groups.map((g) => (
          <div key={g.bucket} className="dh-group">
            <h2 className="dh-group-title">{BUCKET_LABEL[g.bucket]}</h2>
            <table className="dh-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Vacancy</th>
                  <th>Outcome</th>
                  <th>Comments</th>
                  <th>Decision Date</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr
                    key={r.applicationId}
                    className="dh-row"
                    onClick={() => navigate(`/hiring-manager/applications/${r.applicationId}`)}
                  >
                    <td>{r.candidate.name}</td>
                    <td>{r.vacancy.title}</td>
                    <td>
                      <span className={OUTCOME_CLASS[r.outcome]}>{r.outcome}</span>
                    </td>
                    <td>{r.comments ?? "--"}</td>
                    <td>{new Date(r.decidedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
