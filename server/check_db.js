import { all, close, databasePath } from "./db.js";

async function checkDatabase() {
  const counts = await all(`
    SELECT 'lines' AS table_name, COUNT(*) AS rows FROM lines
    UNION ALL SELECT 'stations', COUNT(*) FROM stations
    UNION ALL SELECT 'segments', COUNT(*) FROM segments
    UNION ALL SELECT 'events', COUNT(*) FROM events
    UNION ALL SELECT 'users', COUNT(*) FROM users
    UNION ALL SELECT 'games', COUNT(*) FROM games
    UNION ALL SELECT 'planned_route_segments', COUNT(*) FROM planned_route_segments
    UNION ALL SELECT 'game_steps', COUNT(*) FROM game_steps
  `);

  const interchanges = await all(`
    SELECT s.name, COUNT(ls.line_id) AS line_count
    FROM stations s
    JOIN line_stations ls ON ls.station_id = s.id
    GROUP BY s.id, s.name
    HAVING COUNT(ls.line_id) > 1
    ORDER BY s.name
  `);

  const completedGames = await all(`
    SELECT
      g.id,
      u.username,
      origin.name AS start_station,
      destination.name AS destination_station,
      g.final_score
    FROM games g
    JOIN users u ON u.id = g.user_id
    JOIN stations origin ON origin.id = g.start_station_id
    JOIN stations destination ON destination.id = g.destination_station_id
    WHERE g.status = 'completed'
    ORDER BY g.id
  `);

  const integrity = await all("PRAGMA integrity_check");
  const foreignKeyErrors = await all("PRAGMA foreign_key_check");
  const invalidSteps = await all(`
    SELECT gs.id
    FROM game_steps gs
    JOIN segments s ON s.id = gs.segment_id
    WHERE NOT (
      (gs.from_station_id = s.station1_id AND gs.to_station_id = s.station2_id)
      OR
      (gs.from_station_id = s.station2_id AND gs.to_station_id = s.station1_id)
    )
  `);
  const invalidEvents = await all(`
    SELECT id
    FROM events
    WHERE typeof(effect) <> 'integer' OR effect NOT BETWEEN -4 AND 4
  `);
  const scoreMismatches = await all(`
    SELECT g.id
    FROM games g
    JOIN game_steps gs ON gs.game_id = g.id
    WHERE g.status = 'completed'
      AND gs.step_index = (
        SELECT MAX(last_step.step_index)
        FROM game_steps last_step
        WHERE last_step.game_id = g.id
      )
      AND g.final_score <> MAX(0, gs.coins_after)
  `);
  const invalidGameErrors = await all(`
    SELECT g.id
    FROM games g
    LEFT JOIN game_steps gs ON gs.game_id = g.id
    WHERE g.status = 'invalid'
    GROUP BY g.id
    HAVING g.final_score <> 0 OR COUNT(gs.id) <> 0
  `);
  const negativeFinalScores = await all(`
    SELECT id
    FROM games
    WHERE final_score < 0
  `);
  const gamesBelowMinimumDistance = await all(`
    WITH RECURSIVE reachable(game_id, station_id, distance, path) AS (
      SELECT
        g.id,
        g.start_station_id,
        0,
        ',' || g.start_station_id || ','
      FROM games g

      UNION ALL

      SELECT
        reachable.game_id,
        CASE
          WHEN segments.station1_id = reachable.station_id
          THEN segments.station2_id
          ELSE segments.station1_id
        END,
        reachable.distance + 1,
        reachable.path || CASE
          WHEN segments.station1_id = reachable.station_id
          THEN segments.station2_id
          ELSE segments.station1_id
        END || ','
      FROM reachable
      JOIN segments
        ON segments.station1_id = reachable.station_id
        OR segments.station2_id = reachable.station_id
      WHERE instr(
        reachable.path,
        ',' || CASE
          WHEN segments.station1_id = reachable.station_id
          THEN segments.station2_id
          ELSE segments.station1_id
        END || ','
      ) = 0
    ),
    shortest_distances AS (
      SELECT games.id, MIN(reachable.distance) AS shortest_distance
      FROM games
      LEFT JOIN reachable
        ON reachable.game_id = games.id
        AND reachable.station_id = games.destination_station_id
      GROUP BY games.id
    )
    SELECT id, shortest_distance
    FROM shortest_distances
    WHERE shortest_distance IS NULL OR shortest_distance < 3
  `);

  console.log(`Database: ${databasePath}`);
  console.log("\nRow counts");
  console.table(counts);
  console.log("Interchange stations");
  console.table(interchanges);
  console.log("Completed games");
  console.table(completedGames);
  console.log("Consistency checks");
  console.table([
    {
      integrity: integrity[0].integrity_check,
      foreign_key_errors: foreignKeyErrors.length,
      invalid_game_steps: invalidSteps.length,
      invalid_events: invalidEvents.length,
      score_mismatches: scoreMismatches.length,
      invalid_game_errors: invalidGameErrors.length,
      negative_final_scores: negativeFinalScores.length,
      games_below_min_distance: gamesBelowMinimumDistance.length,
    },
  ]);
}

try {
  await checkDatabase();
} catch (error) {
  console.error("Database check failed. Run `npm run db:init` first.", error);
  process.exitCode = 1;
} finally {
  await close();
}
