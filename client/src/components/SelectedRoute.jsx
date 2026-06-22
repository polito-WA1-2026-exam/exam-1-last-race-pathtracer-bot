function SelectedRoute({ segments, submitting, onRemove, onSubmit }) {
  return (
    <div className="selected-route">
      <div className="section-heading">
        <span>03</span>
        <div>
          <h2>Selected route</h2>
          <p>Segments will be submitted in this exact order.</p>
        </div>
      </div>

      {segments.length === 0 ? (
        <p className="empty-route">No segments selected yet.</p>
      ) : (
        <ol>
          {segments.map((segment) => (
            <li key={segment.id}>
              <span>{segment.station1.name}</span>
              <b>--</b>
              <span>{segment.station2.name}</span>
              <button
                className="route-remove-button"
                type="button"
                disabled={submitting}
                onClick={() => onRemove(segment.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <button
        className="primary-button"
        type="button"
        disabled={submitting}
        onClick={onSubmit}
      >
        {submitting ? "Submitting..." : "Submit Route"}
      </button>
    </div>
  );
}

export default SelectedRoute;
