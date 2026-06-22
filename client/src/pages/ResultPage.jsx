import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getResultData } from "../api.js";

function ResultPage() {
  const { gameId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getResultData(gameId)
      .then((resultData) => {
        if (active) {
          setResult(resultData);
        }
      })
      .catch((resultError) => {
        if (active) {
          setError(resultError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  if (error) {
    return (
      <section className="game-page">
        <p className="page-error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!result) {
    return <div className="map-loading">Loading final result...</div>;
  }

  return (
    <section className="game-page result-page">
      <div className="eyebrow">Phase 4 - Result</div>
      <h1>{result.valid ? "Race complete." : "Invalid route."}</h1>
      <p className="lead">
        {result.startStation} -&gt; {result.destinationStation}
      </p>

      {!result.valid && (
        <p className="page-error">
          The submitted route was incomplete or invalid, so the score is zero.
        </p>
      )}

      <div className="result-score">
        <span>Final score</span>
        <strong>{result.finalScore}</strong>
        <small>coins</small>
      </div>

      <div className="result-actions">
        <Link className="primary-action" to="/setup">
          Play again
        </Link>
        <Link className="secondary-action" to="/ranking">
          Go to ranking
        </Link>
      </div>
    </section>
  );
}

export default ResultPage;
