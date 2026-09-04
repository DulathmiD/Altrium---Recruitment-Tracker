import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMyVacancies, getComparison, type HmVacancy, type Comparison } from "../../api/hiringManager";
import "./CandidateComparisonPage.css";

export default function CandidateComparisonPage() {
  // Dashboard's "Compare N candidates" Needs Attention nudge links here with
  // ?vacancyId=... so the relevant vacancy is pre-selected instead of
  // defaulting to whichever vacancy happens to be first.
  const [searchParams] = useSearchParams();
  const requestedVacancyId = Number(searchParams.get("vacancyId"));

  const [vacancies, setVacancies] = useState<HmVacancy[]>([]);
  const [vacancyId, setVacancyId] = useState<number | "">("");
  const [vacanciesLoading, setVacanciesLoading] = useState(true);
  const [vacanciesError, setVacanciesError] = useState("");

  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyVacancies()
      .then((rows) => {
        setVacancies(rows);
        if (rows.length === 0) return;
        const preselect = rows.some((v) => v.id === requestedVacancyId) ? requestedVacancyId : rows[0].id;
        setVacancyId(preselect);
      })
      .catch((err) => setVacanciesError(err instanceof Error ? err.message : "Could not load vacancies"))
      .finally(() => setVacanciesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vacancyId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    getComparison(vacancyId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load comparison"))
      .finally(() => setLoading(false));
  }, [vacancyId]);

  const maxDistributionCount = data ? Math.max(1, ...data.distribution.map((d) => d.count)) : 1;

  return (
    <div className="cc-page">
      <h1 className="cc-title">Candidate Comparison</h1>
      <div className="cc-divider" />

      <label htmlFor="cc-vacancy-select">Vacancy</label>
      {vacanciesLoading && <p className="cc-muted">Loading vacancies...</p>}
      {vacanciesError && <p className="cc-error">{vacanciesError}</p>}
      {!vacanciesLoading && vacancies.length === 0 && (
        <p className="cc-muted">You're not assigned to any vacancies yet.</p>
      )}
      {!vacanciesLoading && vacancies.length > 0 && (
        <select
          id="cc-vacancy-select"
          value={vacancyId}
          onChange={(e) => setVacancyId(e.target.value ? Number(e.target.value) : "")}
        >
          {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title} - {v.department}</option>)}
        </select>
      )}

      {loading && <p className="cc-muted">Loading comparison...</p>}
      {error && <p className="cc-error">{error}</p>}

      {!loading && data && (
        <>
          {data.topCandidates.length === 0 ? (
            <p className="cc-muted">No shortlisted candidates have any interview feedback yet for this vacancy.</p>
          ) : (
            <>
              <div className="cc-kpi-grid">
                <div className="cc-kpi-tile">
                  <div className="cc-kpi-value">{data.summary.topCandidateCount}</div>
                  <div className="cc-kpi-label">Top Candidates</div>
                </div>
                <div className="cc-kpi-tile">
                  <div className="cc-kpi-value">{data.summary.averageScore ?? "--"}</div>
                  <div className="cc-kpi-label">Average Numeric Score</div>
                </div>
                <div className="cc-kpi-tile">
                  <div className="cc-kpi-value">{data.summary.highestScore ?? "--"}</div>
                  <div className="cc-kpi-label">Highest Numeric Score</div>
                </div>
              </div>

              <div className="cc-panels">
                <div className="cc-panels-left">
                  <div className="cc-panel">
                    <h2 className="cc-panel-title">Top Candidate Score Ranking</h2>
                    <div className="cc-ranking-list">
                      {data.topCandidates.map((c) => (
                        <div key={c.applicationId} className="cc-ranking-row">
                          <span className="cc-rank">#{c.rank}</span>
                          <span className={"cc-candidate-name" + (c.rank === 1 ? " cc-candidate-name-rank" : "")}>
                            {c.name}
                          </span>
                          <div className="cc-bar-track">
                            <div className="cc-bar-fill" style={{ width: `${(c.score / 10) * 100}%` }} />
                          </div>
                          <span className="cc-score">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="cc-panel">
                    <h2 className="cc-panel-title">Numeric Score Distribution</h2>
                    <div className="cc-ranking-list cc-distribution-list">
                      {data.distribution.map((d) => (
                        <div key={d.label} className="cc-ranking-row">
                          <span className="cc-bucket-label">{d.label}</span>
                          <div className="cc-bar-track">
                            <div className="cc-bar-fill" style={{ width: `${(d.count / maxDistributionCount) * 100}%` }} />
                          </div>
                          <span className="cc-score">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="cc-comments-panel">
                  <h2 className="cc-panel-title">Top Candidate Comments</h2>
                  {data.comments.map((c) => (
                    <div key={c.candidateId} className="cc-comment-block">
                      <div className="cc-candidate-name">{c.name}</div>
                      <p className="cc-comment-text">{c.comments.join(" ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
