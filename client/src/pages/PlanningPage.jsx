import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPlanningData,
  submitRoute as submitRouteRequest,
} from "../api.js";
import SegmentList from "../components/SegmentList.jsx";
import SelectedRoute from "../components/SelectedRoute.jsx";
import StationMap from "../components/StationMap.jsx";
import Timer from "../components/Timer.jsx";

function PlanningPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [planning, setPlanning] = useState(null);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedSegmentsRef = useRef([]);
  const submissionStartedRef = useRef(false);

  useEffect(() => {
    let active = true;

    getPlanningData(gameId)
      .then((result) => {
        if (active) {
          setPlanning(result);
          setTimeLeft(result.remainingSeconds);
        }
      })
      .catch((planningError) => {
        if (active) {
          setError(planningError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  function selectSegment(segment) {
    if (submissionStartedRef.current) {
      return;
    }

    setSelectedSegments((currentSegments) => {
      if (
        currentSegments.some(
          (selectedSegment) => selectedSegment.id === segment.id,
        )
      ) {
        return currentSegments;
      }

      const nextSegments = [...currentSegments, segment];
      selectedSegmentsRef.current = nextSegments;
      return nextSegments;
    });
  }

  function removeSegment(segmentId) {
    if (submissionStartedRef.current) {
      return;
    }

    setSelectedSegments((currentSegments) => {
      const nextSegments = currentSegments.filter(
        (segment) => segment.id !== segmentId,
      );
      selectedSegmentsRef.current = nextSegments;
      return nextSegments;
    });
  }

  const submitCurrentRoute = useCallback(
    async (automatic = false) => {
      if (submissionStartedRef.current) {
        return;
      }

      submissionStartedRef.current = true;
      setSubmitting(true);
      setError("");

      try {
        const result = await submitRouteRequest(
          gameId,
          selectedSegmentsRef.current.map((segment) => segment.id),
        );
        navigate(
          result.valid
            ? `/game/${gameId}/execution`
            : `/game/${gameId}/result`,
          {
            replace: true,
            state: { outcome: result, automatic },
          },
        );
      } catch (submissionError) {
        submissionStartedRef.current = false;
        setSubmitting(false);
        setError(submissionError.message);
      }
    },
    [gameId, navigate],
  );

  useEffect(() => {
    if (timeLeft === null || submitting) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (timeLeft <= 0) {
        submitCurrentRoute(true);
      } else {
        setTimeLeft((currentTime) => Math.max(0, currentTime - 1));
      }
    }, timeLeft <= 0 ? 0 : 1000);

    return () => window.clearTimeout(timer);
  }, [submitCurrentRoute, submitting, timeLeft]);

  if (error && !planning) {
    return (
      <section className="planning-page">
        <p className="page-error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!planning) {
    return <div className="map-loading">Preparing the planning phase...</div>;
  }

  const selectedIds = new Set(
    selectedSegments.map((segment) => segment.id),
  );

  return (
    <section className="planning-page">
      <header className="planning-header">
        <div>
          <div className="eyebrow">Phase 2 - Planning</div>
          <h1>Build your route.</h1>
        </div>
        <Timer seconds={timeLeft ?? 0} />
      </header>

      <div className="planning-assignment">
        <article>
          <span>Starting station</span>
          <strong>{planning.startStation.name}</strong>
        </article>
        <div aria-hidden="true">-&gt;</div>
        <article>
          <span>Destination station</span>
          <strong>{planning.destinationStation.name}</strong>
        </article>
      </div>

      {error && (
        <p className="page-error" role="alert">
          {error}
        </p>
      )}

      <div className="planning-layout">
        <div>
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>Station map</h2>
              <p>Connections are hidden during planning.</p>
            </div>
          </div>
          <StationMap
            stations={planning.stations}
            startStationId={planning.startStation.id}
            destinationStationId={planning.destinationStation.id}
          />
        </div>

        <aside className="segment-panel">
          <div className="section-heading">
            <span>02</span>
            <div>
              <h2>Available segments</h2>
              <p>Select each segment at most once.</p>
            </div>
          </div>

          <SegmentList
            segments={planning.segments}
            selectedIds={selectedIds}
            disabled={submitting}
            onSelect={selectSegment}
          />
        </aside>
      </div>

      <SelectedRoute
        segments={selectedSegments}
        submitting={submitting}
        onRemove={removeSegment}
        onSubmit={() => submitCurrentRoute(false)}
      />
    </section>
  );
}

export default PlanningPage;
