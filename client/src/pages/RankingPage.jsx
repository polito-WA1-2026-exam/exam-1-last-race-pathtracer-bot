import { useEffect, useState } from "react";
import { getRanking } from "../api.js";

function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getRanking()
      .then((data) => {
        if (active) {
          setRanking(data.ranking);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="game-page ranking-page">
      <div className="eyebrow">General ranking</div>
      <h1>Best results.</h1>
      <p className="lead">
        Each player appears once with their highest score from a completed
        game.
      </p>

      {loading && <p className="ranking-message">Loading ranking...</p>}

      {error && (
        <p className="form-error ranking-message" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && ranking.length === 0 && (
        <p className="ranking-message">No completed games yet.</p>
      )}

      {!loading && !error && ranking.length > 0 && (
        <div className="ranking-board">
          <div className="ranking-row ranking-header" aria-hidden="true">
            <span>Rank</span>
            <span>Player</span>
            <span>Best score</span>
          </div>

          <ol className="ranking-list" aria-label="Player ranking">
            {ranking.map((entry) => (
              <li
                className={`ranking-row ${
                  entry.position === 1 ? "ranking-winner" : ""
                }`}
                key={entry.username}
              >
                <span className="ranking-position">
                  {String(entry.position).padStart(2, "0")}
                </span>
                <strong>{entry.username}</strong>
                <span className="ranking-score">
                  <b>{entry.bestScore}</b>
                  <small>coins</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export default RankingPage;
