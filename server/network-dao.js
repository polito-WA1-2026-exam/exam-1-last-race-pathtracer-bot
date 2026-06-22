import { all } from "./db.js";

export async function getFullNetwork() {
  const [stations, lines, lineStations, segments, segmentLines] =
    await Promise.all([
      all("SELECT id, name, x, y FROM stations ORDER BY id"),
      all("SELECT id, name, color FROM lines ORDER BY id"),
      all(`
        SELECT line_id, station_id, position
        FROM line_stations
        ORDER BY line_id, position
      `),
      all(`
        SELECT id, station1_id, station2_id
        FROM segments
        ORDER BY id
      `),
      all(`
        SELECT segment_id, line_id
        FROM segment_lines
        ORDER BY segment_id, line_id
      `),
    ]);

  const stationLineIds = new Map(
    stations.map((station) => [station.id, []]),
  );
  const lineStationIds = new Map(lines.map((line) => [line.id, []]));
  const segmentLineIds = new Map(
    segments.map((segment) => [segment.id, []]),
  );

  for (const row of lineStations) {
    stationLineIds.get(row.station_id).push(row.line_id);
    lineStationIds.get(row.line_id).push(row.station_id);
  }

  for (const row of segmentLines) {
    segmentLineIds.get(row.segment_id).push(row.line_id);
  }

  return {
    stations: stations.map((station) => ({
      id: station.id,
      name: station.name,
      x: station.x,
      y: station.y,
      lineIds: stationLineIds.get(station.id),
    })),
    lines: lines.map((line) => ({
      id: line.id,
      name: line.name,
      color: line.color,
      stationIds: lineStationIds.get(line.id),
    })),
    connections: segments.map((segment) => ({
      id: segment.id,
      station1Id: segment.station1_id,
      station2Id: segment.station2_id,
      lineIds: segmentLineIds.get(segment.id),
    })),
  };
}
