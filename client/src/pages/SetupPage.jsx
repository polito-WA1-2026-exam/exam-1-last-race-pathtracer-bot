import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createGame, getFullNetwork } from "../api.js";
import NetworkMap from "../components/NetworkMap.jsx";

function SetupPage() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;

    getFullNetwork()
      .then((result) => {
        if (active) {
          setNetwork(result);
        }
      })
      .catch((networkError) => {
        if (active) {
          setError(networkError.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStartGame() {
    setError("");
    setStarting(true);

    try {
      const game = await createGame();
      navigate(`/game/${game.gameId}/planning`, { state: { game } });
    } catch (gameError) {
      setError(gameError.message);
      setStarting(false);
    }
  }

  return (
    <section className="setup-page">
      <div className="setup-heading">
        <div>
          <div className="eyebrow">Phase 1 - Setup</div>
          <h1>Study the network.</h1>
          <p className="lead">
            Review every station, connection, and metro line. Once the game
            starts, the connecting lines will be hidden during planning.
          </p>
        </div>
        <div className="network-summary" aria-label="Network summary">
          <strong>{network?.stations.length ?? "-"}</strong>
          <span>stations</span>
          <strong>{network?.lines.length ?? "-"}</strong>
          <span>lines</span>
          <strong>{network?.connections.length ?? "-"}</strong>
          <span>connections</span>
        </div>
      </div>

      {error && (
        <p className="page-error" role="alert">
          {error}
        </p>
      )}

      {!network && !error && (
        <div className="map-loading">Loading the underground network...</div>
      )}

      {network && <NetworkMap network={network} />}

      <div className="setup-actions">
        <div>
          <strong>Ready?</strong>
          <p>
            The server will assign two stations at least three segments apart.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={!network || starting}
          onClick={handleStartGame}
        >
          {starting ? "Starting..." : "Start Game"}
        </button>
      </div>
    </section>
  );
}

export default SetupPage;
