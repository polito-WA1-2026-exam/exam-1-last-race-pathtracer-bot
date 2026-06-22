import "./check-node-version.mjs";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport, { requireAuthentication } from "./auth.js";
import {
  createGame,
  findGameByIdForUser,
  GameRequestError,
  getExecutionData,
  getPlanningData,
  getResultData,
  submitRoute,
} from "./games-dao.js";
import { getFullNetwork } from "./network-dao.js";
import { getRanking } from "./ranking-dao.js";

const app = express();
const port = 3001;
const sessionCookieName = "last_race_session";
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use(
  session({
    name: sessionCookieName,
    secret: process.env.SESSION_SECRET ?? "last-race-development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.post("/api/sessions", (req, res, next) => {
  passport.authenticate("local", (error, user, info) => {
    if (error) {
      next(error);
      return;
    }

    if (!user) {
      res.status(401).json({
        error: info?.message ?? "Incorrect username or password.",
      });
      return;
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        next(loginError);
        return;
      }

      res.status(201).json(user);
    });
  })(req, res, next);
});

app.get("/api/sessions/current", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  res.json(req.user);
});

app.delete("/api/sessions/current", (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      next(logoutError);
      return;
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        next(sessionError);
        return;
      }

      res.clearCookie(sessionCookieName);
      res.status(204).end();
    });
  });
});

app.get("/api/game", requireAuthentication, (req, res) => {
  res.json({
    message: `Welcome to Last Race, ${req.user.username}.`,
  });
});

app.get("/api/network/full", requireAuthentication, async (req, res, next) => {
  try {
    res.json(await getFullNetwork());
  } catch (error) {
    next(error);
  }
});

app.post("/api/games", requireAuthentication, async (req, res, next) => {
  try {
    const game = await createGame(req.user.id);
    res.status(201).json(game);
  } catch (error) {
    next(error);
  }
});

function parseGameId(rawGameId) {
  const gameId = Number.parseInt(rawGameId, 10);
  return Number.isInteger(gameId) && gameId > 0 ? gameId : undefined;
}

app.get(
  "/api/games/:gameId/planning",
  requireAuthentication,
  async (req, res, next) => {
    const gameId = parseGameId(req.params.gameId);

    if (!gameId) {
      res.status(400).json({ error: "Invalid game id." });
      return;
    }

    try {
      res.json(await getPlanningData(gameId, req.user.id));
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/games/:gameId/route",
  requireAuthentication,
  async (req, res, next) => {
    const gameId = parseGameId(req.params.gameId);

    if (!gameId) {
      res.status(400).json({ error: "Invalid game id." });
      return;
    }

    try {
      const result = await submitRoute(
        gameId,
        req.user.id,
        req.body.selectedSegmentIds,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/games/:gameId/execution",
  requireAuthentication,
  async (req, res, next) => {
    const gameId = parseGameId(req.params.gameId);

    if (!gameId) {
      res.status(400).json({ error: "Invalid game id." });
      return;
    }

    try {
      res.json(await getExecutionData(gameId, req.user.id));
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/games/:gameId/result",
  requireAuthentication,
  async (req, res, next) => {
    const gameId = parseGameId(req.params.gameId);

    if (!gameId) {
      res.status(400).json({ error: "Invalid game id." });
      return;
    }

    try {
      res.json(await getResultData(gameId, req.user.id));
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/games/:gameId", requireAuthentication, async (req, res, next) => {
  const gameId = parseGameId(req.params.gameId);

  if (!gameId) {
    res.status(400).json({ error: "Invalid game id." });
    return;
  }

  try {
    const game = await findGameByIdForUser(gameId, req.user.id);

    if (!game) {
      res.status(404).json({ error: "Game not found." });
      return;
    }

    res.json(game);
  } catch (error) {
    next(error);
  }
});

app.get("/api/ranking", requireAuthentication, async (req, res, next) => {
  try {
    res.json({ ranking: await getRanking() });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error instanceof GameRequestError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);

  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({ error: "Internal server error." });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
