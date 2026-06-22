function SegmentList({ segments, selectedIds, disabled, onSelect }) {
  return (
    <div className="segment-list">
      {segments.map((segment) => {
        const selected = selectedIds.has(segment.id);

        return (
          <button
            type="button"
            key={segment.id}
            disabled={selected || disabled}
            onClick={() => onSelect(segment)}
          >
            <span>{segment.station1.name}</span>
            <b>--</b>
            <span>{segment.station2.name}</span>
            <small>{selected ? "Selected" : "Add"}</small>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentList;
