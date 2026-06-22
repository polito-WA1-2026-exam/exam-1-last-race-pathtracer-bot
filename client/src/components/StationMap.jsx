function StationMap({ stations, startStationId, destinationStationId }) {
  return (
    <div className="station-map-shell">
      <svg
        className="station-map"
        viewBox="60 20 700 430"
        role="img"
        aria-labelledby="station-map-title station-map-description"
      >
        <title id="station-map-title">Stations-only planning map</title>
        <desc id="station-map-description">
          Station positions and names without any connecting metro lines.
        </desc>

        <g className="planning-stations">
          {stations.map((station) => {
            const classNames = [
              station.id === startStationId ? "start" : "",
              station.id === destinationStationId ? "destination" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <g
                className={classNames}
                key={station.id}
                transform={`translate(${station.x} ${station.y})`}
              >
                <circle r="7" />
                <text x="13" y="-12">
                  {station.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default StationMap;
