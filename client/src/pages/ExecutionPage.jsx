import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getExecutionData } from "../api.js";

function ExecutionPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [execution, setExecution] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getExecutionData(gameId)
      .then((result) => {
        if (active) {
          setExecution(result);
        }
      })
      .catch((executionError) => {
        if (active) {
          setError(executionError.message);
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

  if (!execution) {
    return <div className="map-loading">Loading journey events...</div>;
  }

  const currentStep = execution.steps[currentStepIndex];
  const lastStepVisible = currentStepIndex === execution.steps.length - 1;

  function handleContinue() {
    if (!lastStepVisible) {
      setCurrentStepIndex((currentIndex) => currentIndex + 1);
      return;
    }

    navigate(`/game/${gameId}/result`, {
      replace: true,
      state: {
        outcome: {
          valid: true,
          status: "completed",
          finalScore: execution.finalScore,
        },
      },
    });
  }

  return (
    <section className="game-page execution-page">
      <div className="eyebrow">Phase 3 - Execution</div>
      <h1>Journey events.</h1>
      <p className="lead">
        Reveal each segment in order and see how its event changes your coins.
      </p>

      <div className="execution-progress">
        <span>Journey progress</span>
        <strong>
          {currentStepIndex + 1} / {execution.steps.length}
        </strong>
      </div>

      <div className="execution-steps">
        <article className="active-step" key={currentStep.stepIndex}>
          <span>Step {currentStep.stepIndex}</span>
          <h2>
            {currentStep.fromStation} -&gt; {currentStep.toStation}
          </h2>
          <p>
            <b>Event:</b> {currentStep.eventDescription}
          </p>
          <div>
            <strong>
              {currentStep.effect >= 0 ? "+" : ""}
              {currentStep.effect}
            </strong>
            <small>{currentStep.coinsAfter} coins</small>
          </div>
        </article>
      </div>

      <button className="primary-button" type="button" onClick={handleContinue}>
        {lastStepVisible ? "View Result" : "Next step"}
      </button>
    </section>
  );
}

export default ExecutionPage;
