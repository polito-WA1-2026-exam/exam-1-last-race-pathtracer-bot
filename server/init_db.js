import { randomBytes, scryptSync } from "node:crypto";
import { close, databasePath, exec, get, run } from "./db.js";

const lines = [
  { id: 1, name: "Red Line", color: "#D7263D", stations: [5, 1, 11, 7, 10] },
  { id: 2, name: "Blue Line", color: "#247BA0", stations: [4, 3, 1, 8, 9] },
  { id: 3, name: "Green Line", color: "#2EAD66", stations: [6, 2, 11, 12, 13] },
  { id: 4, name: "Yellow Line", color: "#F2C14E", stations: [14, 2, 7, 8, 15] },
];

const stations = [
  [1, "Central", 420, 260],
  [2, "Museum", 300, 260],
  [3, "University", 420, 160],
  [4, "North Park", 420, 70],
  [5, "Airport", 120, 260],
  [6, "Old Town", 180, 380],
  [7, "Market", 540, 260],
  [8, "Riverside", 540, 160],
  [9, "Harbor", 680, 160],
  [10, "Stadium", 680, 260],
  [11, "City Hall", 420, 380],
  [12, "Tech Park", 540, 380],
  [13, "South Gate", 680, 380],
  [14, "Garden", 180, 160],
  [15, "East End", 680, 70],
];

const events = [
  [1, "You found a forgotten ticket refund.", 3],
  [2, "A signal failure delayed your train.", -2],
  [3, "An express train shortened your trip.", 2],
  [4, "You bought a snack at the station.", -1],
  [5, "A fellow passenger shared a day pass.", 4],
  [6, "You boarded the wrong train.", -3],
  [7, "The station offered a travel bonus.", 1],
  [8, "Maintenance forced an unexpected transfer.", -2],
];

const users = [
  [1, "alice", "AliceRace!1"],
  [2, "bob", "BobRace!2"],
  [3, "carol", "CarolRace!3"],
];

const games = [
  [1, 1, 5, 10, 21, "completed", "2026-05-20T09:00:00.000Z", "2026-05-20T09:08:00.000Z", "2026-05-20T09:01:30.000Z", "2026-05-20T09:01:10.000Z", 0],
  [2, 2, 4, 9, 22, "completed", "2026-05-22T15:30:00.000Z", "2026-05-22T15:37:00.000Z", "2026-05-22T15:31:30.000Z", "2026-05-22T15:31:02.000Z", 0],
  [3, 1, 6, 13, 21, "completed", "2026-05-25T18:10:00.000Z", "2026-05-25T18:18:00.000Z", "2026-05-25T18:11:30.000Z", "2026-05-25T18:11:15.000Z", 0],
  [4, 3, 14, 15, null, "in_progress", "2026-05-28T11:45:00.000Z", null, "2026-05-28T11:46:30.000Z", "2026-05-28T11:46:12.000Z", 0],
];

const schema = `
  DROP TABLE IF EXISTS game_steps;
  DROP TABLE IF EXISTS planned_route_segments;
  DROP TABLE IF EXISTS games;
  DROP TABLE IF EXISTS events;
  DROP TABLE IF EXISTS segment_lines;
  DROP TABLE IF EXISTS segments;
  DROP TABLE IF EXISTS line_stations;
  DROP TABLE IF EXISTS lines;
  DROP TABLE IF EXISTS stations;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL
  );

  CREATE TABLE stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL
  );

  CREATE TABLE lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL UNIQUE
  );

  CREATE TABLE line_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    UNIQUE (line_id, station_id),
    UNIQUE (line_id, position)
  );

  CREATE TABLE segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station1_id INTEGER NOT NULL REFERENCES stations(id),
    station2_id INTEGER NOT NULL REFERENCES stations(id),
    CHECK (station1_id < station2_id),
    UNIQUE (station1_id, station2_id)
  );

  CREATE TABLE segment_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    UNIQUE (segment_id, line_id)
  );

  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    effect INTEGER NOT NULL CHECK (effect BETWEEN -4 AND 4)
  );

  CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    start_station_id INTEGER NOT NULL REFERENCES stations(id),
    destination_station_id INTEGER NOT NULL REFERENCES stations(id),
    final_score INTEGER CHECK (final_score IS NULL OR final_score >= 0),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'invalid', 'abandoned')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    planning_deadline_at TEXT NOT NULL,
    planning_submitted_at TEXT,
    planning_timed_out INTEGER NOT NULL DEFAULT 0 CHECK (planning_timed_out IN (0, 1)),
    CHECK (start_station_id <> destination_station_id),
    CHECK (
      (
        status IN ('completed', 'invalid')
        AND final_score IS NOT NULL
        AND completed_at IS NOT NULL
      )
      OR (status NOT IN ('completed', 'invalid'))
    ),
    CHECK (
      status <> 'invalid'
      OR final_score = 0
    )
  );

  CREATE TABLE planned_route_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    segment_id INTEGER NOT NULL REFERENCES segments(id),
    position INTEGER NOT NULL CHECK (position >= 0),
    UNIQUE (game_id, position)
  );

  CREATE TABLE game_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL CHECK (step_index >= 0),
    segment_id INTEGER NOT NULL REFERENCES segments(id),
    from_station_id INTEGER NOT NULL REFERENCES stations(id),
    to_station_id INTEGER NOT NULL REFERENCES stations(id),
    event_id INTEGER REFERENCES events(id),
    coins_after INTEGER NOT NULL,
    CHECK (from_station_id <> to_station_id),
    UNIQUE (game_id, step_index)
  );

  CREATE INDEX idx_line_stations_station ON line_stations(station_id);
  CREATE INDEX idx_segment_lines_line ON segment_lines(line_id);
  CREATE INDEX idx_games_user ON games(user_id);
  CREATE INDEX idx_planned_route_game ON planned_route_segments(game_id);
  CREATE INDEX idx_game_steps_game ON game_steps(game_id);
`;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 64).toString("hex");
  return { salt, passwordHash };
}

function segmentKey(stationA, stationB) {
  return [Math.min(stationA, stationB), Math.max(stationA, stationB)].join("-");
}

const stationsById = new Map(
  stations.map(([id, name, x, y]) => [id, { id, name, x, y }]),
);

function distanceSquared(stationA, stationB) {
  return (stationA.x - stationB.x) ** 2 + (stationA.y - stationB.y) ** 2;
}

function isBetweenStations(candidate, stationA, stationB) {
  if (candidate.id === stationA.id || candidate.id === stationB.id) {
    return false;
  }

  const crossProduct =
    (candidate.x - stationA.x) * (stationB.y - stationA.y) -
    (candidate.y - stationA.y) * (stationB.x - stationA.x);

  if (crossProduct !== 0) {
    return false;
  }

  return (
    candidate.x >= Math.min(stationA.x, stationB.x) &&
    candidate.x <= Math.max(stationA.x, stationB.x) &&
    candidate.y >= Math.min(stationA.y, stationB.y) &&
    candidate.y <= Math.max(stationA.y, stationB.y)
  );
}

function expandLineStations(stationIds) {
  const expanded = [];

  for (let index = 0; index < stationIds.length - 1; index += 1) {
    const stationA = stationsById.get(stationIds[index]);
    const stationB = stationsById.get(stationIds[index + 1]);
    const stationsOnSegment = [
      stationA,
      ...stations
        .map(([id]) => stationsById.get(id))
        .filter((station) => isBetweenStations(station, stationA, stationB))
        .sort(
          (first, second) =>
            distanceSquared(stationA, first) -
            distanceSquared(stationA, second),
        ),
      stationB,
    ];

    for (const station of stationsOnSegment) {
      if (expanded.at(-1) !== station.id) {
        expanded.push(station.id);
      }
    }
  }

  return expanded;
}

async function seedNetwork() {
  for (const [id, name, x, y] of stations) {
    await run("INSERT INTO stations (id, name, x, y) VALUES (?, ?, ?, ?)", [id, name, x, y]);
  }

  for (const line of lines) {
    const lineStationIds = expandLineStations(line.stations);

    await run("INSERT INTO lines (id, name, color) VALUES (?, ?, ?)", [
      line.id,
      line.name,
      line.color,
    ]);

    for (const [position, stationId] of lineStationIds.entries()) {
      await run(
        "INSERT INTO line_stations (line_id, station_id, position) VALUES (?, ?, ?)",
        [line.id, stationId, position],
      );
    }
  }

  const segmentIds = new Map();

  for (const line of lines) {
    const lineStationIds = expandLineStations(line.stations);

    for (let index = 0; index < lineStationIds.length - 1; index += 1) {
      const stationA = lineStationIds[index];
      const stationB = lineStationIds[index + 1];
      const station1 = Math.min(stationA, stationB);
      const station2 = Math.max(stationA, stationB);
      const key = segmentKey(stationA, stationB);

      if (!segmentIds.has(key)) {
        const result = await run(
          "INSERT INTO segments (station1_id, station2_id) VALUES (?, ?)",
          [station1, station2],
        );
        segmentIds.set(key, result.id);
      }

      await run("INSERT INTO segment_lines (segment_id, line_id) VALUES (?, ?)", [
        segmentIds.get(key),
        line.id,
      ]);
    }
  }

  return segmentIds;
}

async function seedUsersAndEvents() {
  for (const [id, username, password] of users) {
    const { salt, passwordHash } = hashPassword(password);
    await run(
      "INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)",
      [id, username, passwordHash, salt],
    );
  }

  for (const [id, description, effect] of events) {
    await run("INSERT INTO events (id, description, effect) VALUES (?, ?, ?)", [
      id,
      description,
      effect,
    ]);
  }
}

async function seedGames(segmentIds) {
  for (const game of games) {
    await run(
      `INSERT INTO games (
        id, user_id, start_station_id, destination_station_id,
        final_score, status, created_at, completed_at,
        planning_deadline_at, planning_submitted_at, planning_timed_out
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      game,
    );
  }

  const steps = [
    [1, 0, 5, 2, 1, 23],
    [1, 1, 2, 1, 2, 21],
    [1, 2, 1, 11, 7, 22],
    [1, 3, 11, 7, 8, 20],
    [1, 4, 7, 10, 7, 21],
    [2, 0, 4, 3, 5, 24],
    [2, 1, 3, 1, 7, 25],
    [2, 2, 1, 8, 4, 24],
    [2, 3, 8, 9, 2, 22],
    [3, 0, 6, 2, 6, 17],
    [3, 1, 2, 11, 1, 20],
    [3, 2, 11, 12, 3, 22],
    [3, 3, 12, 13, 4, 21],
    [4, 0, 14, 2, 8, 18],
    [4, 1, 2, 1, 7, 19],
    [4, 2, 1, 7, 4, 18],
  ];

  for (const [gameId, stepIndex, from, to, eventId, coinsAfter] of steps) {
    const segmentId = segmentIds.get(segmentKey(from, to));

    await run(
      `INSERT INTO planned_route_segments (
        game_id, segment_id, position
      ) VALUES (?, ?, ?)`,
      [gameId, segmentId, stepIndex],
    );

    await run(
      `INSERT INTO game_steps (
        game_id, step_index, segment_id, from_station_id,
        to_station_id, event_id, coins_after
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gameId, stepIndex, segmentId, from, to, eventId, coinsAfter],
    );
  }
}

async function initializeDatabase() {
  await exec("PRAGMA foreign_keys = OFF;");
  await exec(schema);
  await exec("PRAGMA foreign_keys = ON;");
  await exec("BEGIN TRANSACTION;");

  try {
    const segmentIds = await seedNetwork();
    await seedUsersAndEvents();
    await seedGames(segmentIds);
    await exec("COMMIT;");
  } catch (error) {
    await exec("ROLLBACK;");
    throw error;
  }

  const summary = await get(`
    SELECT
      (SELECT COUNT(*) FROM lines) AS lines,
      (SELECT COUNT(*) FROM stations) AS stations,
      (SELECT COUNT(*) FROM events) AS events,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM games) AS games
  `);

  console.log(`Database initialized at ${databasePath}`);
  console.table([summary]);
  console.log("Seed login credentials:");
  console.table(users.map(([, username, password]) => ({ username, password })));
}

try {
  await initializeDatabase();
} catch (error) {
  console.error("Database initialization failed:", error);
  process.exitCode = 1;
} finally {
  await close();
}
