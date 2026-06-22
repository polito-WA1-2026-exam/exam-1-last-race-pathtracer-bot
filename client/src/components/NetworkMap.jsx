function NetworkMap({ network }) {
  const stationsById = new Map(
    network.stations.map((station) => [station.id, station]),
  );

  return (
    <div className="network-map-shell">
      <svg
        className="network-map"
        viewBox="60 20 700 430"
        role="img"
        aria-labelledby="network-map-title network-map-description"
      >
        <title id="network-map-title">Complete underground network</title>
        <desc id="network-map-description">
          All metro lines, connections, and named stations.
        </desc>

        <g className="map-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <line
              key={`vertical-${index}`}
              x1={100 + index * 90}
              y1="30"
              x2={100 + index * 90}
              y2="430"
            />
          ))}
          {Array.from({ length: 5 }, (_, index) => (
            <line
              key={`horizontal-${index}`}
              x1="70"
              y1={70 + index * 90}
              x2="750"
              y2={70 + index * 90}
            />
          ))}
        </g>

        <g className="metro-lines">
          {network.lines.map((line) => (
            <g key={line.id}>
              {line.stationIds.slice(0, -1).map((stationId, index) => {
                const from = stationsById.get(stationId);
                const to = stationsById.get(line.stationIds[index + 1]);

                return (
                  <line
                    key={`${line.id}-${from.id}-${to.id}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={line.color}
                  />
                );
              })}
            </g>
          ))}
        </g>

        <g className="metro-stations">
          {network.stations.map((station) => (
            <g
              className={station.lineIds.length > 1 ? "interchange" : ""}
              key={station.id}
              transform={`translate(${station.x} ${station.y})`}
            >
              <circle r={station.lineIds.length > 1 ? 10 : 7} />
              <text x="13" y="-12">
                {station.name}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className="map-legend" aria-label="Metro lines">
        {network.lines.map((line) => (
          <div className="legend-item" key={line.id}>
            <span style={{ backgroundColor: line.color }} />
            {line.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NetworkMap;
