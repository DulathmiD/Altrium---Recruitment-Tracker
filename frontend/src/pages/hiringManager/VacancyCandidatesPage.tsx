import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getVacancyCandidates, type VacancyCandidateRow } from "../../api/hiringManager";
import "./VacancyCandidatesPage.css";

function statusFor(stage: VacancyCandidateRow["stage"]): { label: string; cls: string } {
  if (stage === "REJECTED") return { label: "Rejected", cls: "vc-status vc-status-red" };
  if (stage === "HIRED") return { label: "Hired", cls: "vc-status vc-status-gold" };
  return { label: "In Progress", cls: "vc-status vc-status-green" };
}

// Corrections doc: the Action column was rendering a bare "--" for anything
// that wasn't currently awaiting a decision, which read as broken/empty
// rather than "nothing to do here." Every row now gets an actual word
// describing why there's no action right now, all in the same size/weight
// as "Awaiting your decision" -- only the color differs by urgency: amber
// for something to act on, gray for still waiting on someone else, green
// for already resolved. `priority` drives the row sort below (most
// actionable first).
function actionFor(r: VacancyCandidateRow): { label: string; cls: string; priority: number } {
  if (r.awaitingDecision) return { label: "Awaiting your decision", cls: "vc-awaiting", priority: 0 };
  if (r.stage === "HIRED" || r.stage === "REJECTED") return { label: "Done", cls: "vc-action-done", priority: 2 };
  if (!r.round) return { label: "Not yet interviewed", cls: "vc-action-waiting", priority: 1 };
  return { label: "Waiting on panel feedback", cls: "vc-action-waiting", priority: 1 };
}

export default function VacancyCandidatesPage() {
  const { vacancyId } = useParams<{ vacancyId: string }>();
  const navigate = useNavigate();
  const id = Number(vacancyId);

  const [rows, setRows] = useState<VacancyCandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (Number.isNaN(id)) return;
    getVacancyCandidates(id)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load candidates"))
      .finally(() => setLoading(false));
  }, [id]);

  // Corrections doc: awaiting-your-decision rows first, then still-waiting
  // ones, done (hired/rejected) last -- most actionable at the top. Stable
  // sort keeps each group in the order the API returned it.
  const sortedRows = useMemo(
    () => rows.slice().sort((a, b) => actionFor(a).priority - actionFor(b).priority),
    [rows]
  );

  return (
    <div className="vc-page">
      <Link to="/hiring-manager/vacancies" className="vc-back-link">&larr; Vacancies</Link>
      <h1 className="vc-title">Candidates</h1>
      <div className="vc-divider" />

      {loading && <p className="vc-muted">Loading...</p>}
      {error && <p className="vc-error">{error}</p>}
      {!loading && rows.length === 0 && <p className="vc-muted">No candidates on this vacancy yet.</p>}

      {!loading && rows.length > 0 && (
        <table className="vc-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Current Round</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const status = statusFor(r.stage);
              const action = actionFor(r);
              return (
                <tr
                  key={r.applicationId}
                  className="vc-row"
                  onClick={() => navigate(`/hiring-manager/applications/${r.applicationId}`)}
                >
                  <td>
                    <div className="vc-candidate-name">{r.candidate.name}</div>
                    <div className="vc-candidate-email">{r.candidate.email}</div>
                  </td>
                  <td>{r.round ? `${r.round.name}` : "--"}</td>
                  <td><span className={status.cls}>{status.label}</span></td>
                  <td>
                    <span className={action.cls}>{action.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
