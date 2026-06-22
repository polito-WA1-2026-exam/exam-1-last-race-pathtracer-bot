import { randomInt } from "node:crypto";
import { all, exec, get, run } from "./db.js";

const INITIAL_COINS = 20;
const MINIMUM_DISTANCE = 3;
const PLANNING_DURATION_MS = 90 * 1000;

export class GameRequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function shortestDistance(adjacency, startId, destinationId) {
  const queue = [{ stationId: startId, distance: 0 }];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.stationId === destinationId) {
      return current.distance;
    }

    for (const neighborId of adjacency.get(current.stationId) ?? []) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          stationId: neighborId,
          distance: current.distance + 1,
        });
      }
    }
  }

  return Number.POSITIVE_INFINITY;
}

async function chooseStations() {
  const [stations, segments] = await Promise.all([
    all("SELECT id, name FROM stations ORDER BY id"),
    all("SELECT station1_id, station2_id FROM segments"),
  ]);

  const adjacency = new Map(
    stations.map((station) => [station.id, new Set()]),
  );

  for (const segment of segments) {
    adjacency.get(segment.station1_id).add(segment.station2_id);
    adjacency.get(segment.station2_id).add(segment.station1_id);
  }

  const eligiblePairs = [];

  for (let first = 0; first < stations.length; first += 1) {
    for (let second = first + 1; second < stations.length; second += 1) {
      const distance = shortestDistance(
        adjacency,
        stations[first].id,
        stations[second].id,
      );

      if (distance >= MINIMUM_DISTANCE && Number.isFinite(distance)) {
        eligiblePairs.push({
          first: stations[first],
          second: stations[second],
          minimumDistance: distance,
        });
      }
    }
  }

  if (eligiblePairs.length === 0) {
    throw new Error(
      "The network has no station pair with a minimum distance of 3 segments.",
    );
  }

  const selectedPair = eligiblePairs[randomInt(eligiblePairs.length)];
  const reverseDirection = randomInt(2) === 1;

  return {
    start: reverseDirection ? selectedPair.second : selectedPair.first,
    destination: reverseDirection ? selectedPair.first : selectedPair.second,
    minimumDistance: selectedPair.minimumDistance,
  };
}

function toPublicGame(row) {
  return {
    id: row.id,
    status: row.status,
    finalScore: row.final_score,
    phase:
      row.status === "completed" || row.status === "invalid"
        ? "result"
        : row.planning_submitted_at
          ? "execution"
          : "planning",
    coins: row.current_coins,
    createdAt: row.created_at,
    startStation: {
      id: row.start_station_id,
      name: row.start_station_name,
    },
    destinationStation: {
      id: row.destination_station_id,
      name: row.destination_station_name,
    },
  };
}

export async function createGame(userId) {
  const assignment = await chooseStations();
  const createdAt = new Date();
  const planningDeadline = new Date(
    createdAt.getTime() + PLANNING_DURATION_MS,
  );
  const result = await run(
    `INSERT INTO games (
      user_id, start_station_id, destination_station_id, status,
      created_at, planning_deadline_at
    ) VALUES (?, ?, ?, 'in_progress', ?, ?)`,
    [
      userId,
      assignment.start.id,
      assignment.destination.id,
      createdAt.toISOString(),
      planningDeadline.toISOString(),
    ],
  );

  const game = await findGameByIdForUser(result.id, userId);

  return {
    gameId: game.id,
    status: game.status,
    phase: game.phase,
    coins: game.coins,
    createdAt: game.createdAt,
    startStation: game.startStation,
    destinationStation: game.destinationStation,
  };
}

export async function findGameByIdForUser(gameId, userId) {
  const row = await get(
    `SELECT
      g.id,
      g.status,
      g.final_score,
      g.created_at,
      g.planning_submitted_at,
      COALESCE((
        SELECT gs.coins_after
        FROM game_steps gs
        WHERE gs.game_id = g.id
        ORDER BY gs.step_index DESC
        LIMIT 1
      ), g.final_score, ${INITIAL_COINS}) AS current_coins,
      (
        SELECT COUNT(*)
        FROM game_steps gs
        WHERE gs.game_id = g.id
      ) AS step_count,
      g.start_station_id,
      origin.name AS start_station_name,
      g.destination_station_id,
      destination.name AS destination_station_name
    FROM games g
    JOIN stations origin ON origin.id = g.start_station_id
    JOIN stations destination ON destination.id = g.destination_station_id
    WHERE g.id = ? AND g.user_id = ?`,
    [gameId, userId],
  );

  return row ? toPublicGame(row) : undefined;
}

export async function getPlanningData(gameId, userId) {
  const game = await get(
    `SELECT
      g.id,
      g.status,
      g.start_station_id,
      origin.name AS start_station_name,
      g.destination_station_id,
      destination.name AS destination_station_name,
      g.planning_deadline_at,
      g.planning_submitted_at
    FROM games g
    JOIN stations origin ON origin.id = g.start_station_id
    JOIN stations destination ON destination.id = g.destination_station_id
    WHERE g.id = ? AND g.user_id = ?`,
    [gameId, userId],
  );

  if (!game) {
    throw new GameRequestError("Game not found.", 404);
  }

  if (game.status !== "in_progress" || game.planning_submitted_at) {
    throw new GameRequestError("The planning phase has already ended.", 409);
  }

  const [stations, segments] = await Promise.all([
    all("SELECT id, name, x, y FROM stations ORDER BY name"),
    all(`
      SELECT
        s.id,
        s.station1_id,
        station1.name AS station1_name,
        s.station2_id,
        station2.name AS station2_name
      FROM segments s
      JOIN stations station1 ON station1.id = s.station1_id
      JOIN stations station2 ON station2.id = s.station2_id
      ORDER BY station1.name, station2.name
    `),
  ]);

  const deadline = new Date(game.planning_deadline_at).getTime();
  const remainingSeconds = Math.max(
    0,
    Math.ceil((deadline - Date.now()) / 1000),
  );

  return {
    gameId: game.id,
    startStation: {
      id: game.start_station_id,
      name: game.start_station_name,
    },
    destinationStation: {
      id: game.destination_station_id,
      name: game.destination_station_name,
    },
    stations,
    segments: segments.map((segment) => ({
      id: segment.id,
      station1: {
        id: segment.station1_id,
        name: segment.station1_name,
      },
      station2: {
        id: segment.station2_id,
        name: segment.station2_name,
      },
    })),
    remainingSeconds,
  };
}

function validateSelectedSegmentIds(selectedSegmentIds) {
  if (!Array.isArray(selectedSegmentIds)) {
    throw new GameRequestError("selectedSegmentIds must be an array.", 400);
  }

  if (
    selectedSegmentIds.some(
      (segmentId) => !Number.isInteger(segmentId) || segmentId <= 0,
    )
  ) {
    throw new GameRequestError(
      "Every selected segment id must be a positive integer.",
      400,
    );
  }

}

function invalidRoute(reason) {
  return { valid: false, reason };
}

async function loadRouteContext(gameId, userId, selectedSegmentIds) {
  const game = await get(
    `SELECT
      id,
      status,
      start_station_id,
      destination_station_id,
      planning_deadline_at,
      planning_submitted_at
    FROM games
    WHERE id = ? AND user_id = ?`,
    [gameId, userId],
  );

  if (!game) {
    throw new GameRequestError("Game not found.", 404);
  }

  if (game.status !== "in_progress" || game.planning_submitted_at) {
    throw new GameRequestError("The planning phase has already ended.", 409);
  }

  const uniqueSegmentIds = [...new Set(selectedSegmentIds)];
  let segmentRows = [];

  if (uniqueSegmentIds.length > 0) {
    const placeholders = uniqueSegmentIds.map(() => "?").join(", ");
    segmentRows = await all(
      `SELECT
        s.id,
        s.station1_id,
        station1.name AS station1_name,
        s.station2_id,
        station2.name AS station2_name
      FROM segments s
      JOIN stations station1 ON station1.id = s.station1_id
      JOIN stations station2 ON station2.id = s.station2_id
      WHERE s.id IN (${placeholders})`,
      uniqueSegmentIds,
    );
  }

  const segmentLineRows =
    uniqueSegmentIds.length === 0
      ? []
      : await all(
          `SELECT segment_id, line_id
          FROM segment_lines
          WHERE segment_id IN (${uniqueSegmentIds.map(() => "?").join(", ")})`,
          uniqueSegmentIds,
        );

  const stationLineRows = await all(`
    SELECT station_id, COUNT(DISTINCT line_id) AS line_count
    FROM line_stations
    GROUP BY station_id
  `);
  const events = await all(
    "SELECT id, description, effect FROM events ORDER BY id",
  );

  return {
    game,
    segmentRows,
    segmentLineRows,
    stationLineRows,
    events,
  };
}

function validateRoute(
  game,
  selectedSegmentIds,
  segmentRows,
  segmentLineRows,
  stationLineRows,
) {
  if (selectedSegmentIds.length === 0) {
    return invalidRoute("The submitted route is empty.");
  }

  if (new Set(selectedSegmentIds).size !== selectedSegmentIds.length) {
    return invalidRoute("The same segment was selected more than once.");
  }

  const segmentsById = new Map(
    segmentRows.map((segment) => [segment.id, segment]),
  );
  const lineIdsBySegment = new Map(
    segmentRows.map((segment) => [segment.id, []]),
  );
  const lineCountByStation = new Map(
    stationLineRows.map((row) => [row.station_id, row.line_count]),
  );

  for (const row of segmentLineRows) {
    lineIdsBySegment.get(row.segment_id)?.push(row.line_id);
  }

  let currentStationId = game.start_station_id;
  const traversedSegments = [];

  for (const segmentId of selectedSegmentIds) {
    const segment = segmentsById.get(segmentId);

    if (!segment) {
      return invalidRoute(`Segment ${segmentId} does not exist.`);
    }

    let nextStationId;

    if (segment.station1_id === currentStationId) {
      nextStationId = segment.station2_id;
    } else if (segment.station2_id === currentStationId) {
      nextStationId = segment.station1_id;
    } else {
      return invalidRoute(
        `Segment ${segmentId} is not connected to the current station.`,
      );
    }

    const lineIds = lineIdsBySegment.get(segmentId) ?? [];

    if (lineIds.length === 0) {
      return invalidRoute(`Segment ${segmentId} is not served by any line.`);
    }

    traversedSegments.push({
      id: segmentId,
      fromStationId: currentStationId,
      toStationId: nextStationId,
      fromStationName:
        currentStationId === segment.station1_id
          ? segment.station1_name
          : segment.station2_name,
      toStationName:
        nextStationId === segment.station1_id
          ? segment.station1_name
          : segment.station2_name,
      lineIds,
    });
    currentStationId = nextStationId;
  }

  if (currentStationId !== game.destination_station_id) {
    return invalidRoute(
      "The submitted route does not end at the assigned destination.",
    );
  }

  let possibleLineIds = new Set(traversedSegments[0].lineIds);

  for (let index = 1; index < traversedSegments.length; index += 1) {
    const segment = traversedSegments[index];
    const transferStationId = segment.fromStationId;
    const isInterchange = (lineCountByStation.get(transferStationId) ?? 0) > 1;
    const nextPossibleLineIds = new Set();

    for (const previousLineId of possibleLineIds) {
      for (const nextLineId of segment.lineIds) {
        if (previousLineId === nextLineId || isInterchange) {
          nextPossibleLineIds.add(nextLineId);
        }
      }
    }

    if (nextPossibleLineIds.size === 0) {
      return invalidRoute(
        "The route changes line at a station that is not an interchange.",
      );
    }

    possibleLineIds = nextPossibleLineIds;
  }

  return { valid: true, traversedSegments };
}

export async function submitRoute(
  gameId,
  userId,
  selectedSegmentIds,
) {
  validateSelectedSegmentIds(selectedSegmentIds);
  const context = await loadRouteContext(
    gameId,
    userId,
    selectedSegmentIds,
  );
  const validation = validateRoute(
    context.game,
    selectedSegmentIds,
    context.segmentRows,
    context.segmentLineRows,
    context.stationLineRows,
  );
  const submittedAt = new Date();
  const timedOut =
    submittedAt.getTime() >=
    new Date(context.game.planning_deadline_at).getTime();

  await exec("BEGIN IMMEDIATE TRANSACTION;");

  try {
    const claim = await run(
      `UPDATE games
      SET planning_submitted_at = ?, planning_timed_out = ?
      WHERE id = ? AND user_id = ? AND planning_submitted_at IS NULL`,
      [submittedAt.toISOString(), timedOut ? 1 : 0, gameId, userId],
    );

    if (claim.changes !== 1) {
      throw new GameRequestError("The planning phase has already ended.", 409);
    }

    const existingSegmentIds = new Set(
      context.segmentRows.map((segment) => segment.id),
    );

    for (const [position, segmentId] of selectedSegmentIds.entries()) {
      if (!existingSegmentIds.has(segmentId)) {
        continue;
      }

      await run(
        `INSERT INTO planned_route_segments (game_id, segment_id, position)
        VALUES (?, ?, ?)`,
        [gameId, segmentId, position],
      );
    }

    if (!validation.valid) {
      await run(
        `UPDATE games
        SET status = 'invalid', final_score = 0, completed_at = ?
        WHERE id = ?`,
        [submittedAt.toISOString(), gameId],
      );
      await exec("COMMIT;");

      return {
        gameId,
        valid: false,
        status: "invalid",
        phase: "result",
        finalScore: 0,
        reason: validation.reason,
        timedOut,
      };
    }

    if (context.events.length === 0) {
      throw new Error("No events are available for route execution.");
    }

    let coins = INITIAL_COINS;

    for (const [stepIndex, segment] of validation.traversedSegments.entries()) {
      const event = context.events[randomInt(context.events.length)];
      coins += event.effect;

      await run(
        `INSERT INTO game_steps (
          game_id, step_index, segment_id, from_station_id,
          to_station_id, event_id, coins_after
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          stepIndex,
          segment.id,
          segment.fromStationId,
          segment.toStationId,
          event.id,
          coins,
        ],
      );
    }

    const finalScore = Math.max(coins, 0);
    await run(
      `UPDATE games
      SET status = 'completed', final_score = ?, completed_at = ?
      WHERE id = ?`,
      [finalScore, submittedAt.toISOString(), gameId],
    );

    await exec("COMMIT;");

    return {
      gameId,
      valid: true,
      status: "completed",
      phase: "execution",
      timedOut,
    };
  } catch (error) {
    await exec("ROLLBACK;");
    throw error;
  }
}

export async function getExecutionData(gameId, userId) {
  const game = await get(
    `SELECT
      g.id,
      g.status,
      g.final_score
    FROM games g
    WHERE g.id = ? AND g.user_id = ?`,
    [gameId, userId],
  );

  if (!game) {
    throw new GameRequestError("Game not found.", 404);
  }

  if (game.status === "invalid") {
    throw new GameRequestError(
      "Invalid routes do not have execution steps.",
      409,
    );
  }

  if (game.status !== "completed") {
    throw new GameRequestError(
      "The route has not been executed yet.",
      409,
    );
  }

  const steps = await all(
    `SELECT
      gs.step_index,
      origin.name AS from_station,
      destination.name AS to_station,
      e.description AS event_description,
      e.effect,
      gs.coins_after
    FROM game_steps gs
    JOIN stations origin ON origin.id = gs.from_station_id
    JOIN stations destination ON destination.id = gs.to_station_id
    JOIN events e ON e.id = gs.event_id
    WHERE gs.game_id = ?
    ORDER BY gs.step_index`,
    [gameId],
  );

  if (steps.length === 0) {
    throw new GameRequestError(
      "No execution steps were generated for this game.",
      409,
    );
  }

  return {
    gameId: game.id,
    finalScore: game.final_score,
    steps: steps.map((step) => ({
      stepIndex: step.step_index + 1,
      fromStation: step.from_station,
      toStation: step.to_station,
      eventDescription: step.event_description,
      effect: step.effect,
      coinsAfter: step.coins_after,
    })),
  };
}

export async function getResultData(gameId, userId) {
  const game = await get(
    `SELECT
      g.id,
      g.status,
      g.final_score,
      g.completed_at,
      origin.name AS start_station,
      destination.name AS destination_station
    FROM games g
    JOIN stations origin ON origin.id = g.start_station_id
    JOIN stations destination ON destination.id = g.destination_station_id
    WHERE g.id = ? AND g.user_id = ?`,
    [gameId, userId],
  );

  if (!game) {
    throw new GameRequestError("Game not found.", 404);
  }

  if (!["completed", "invalid"].includes(game.status)) {
    throw new GameRequestError(
      "The game has not reached the result phase yet.",
      409,
    );
  }

  return {
    gameId: game.id,
    status: game.status,
    valid: game.status === "completed",
    finalScore: Math.max(game.final_score ?? 0, 0),
    startStation: game.start_station,
    destinationStation: game.destination_station,
    completedAt: game.completed_at,
  };
}
