import { scryptSync, timingSafeEqual } from "node:crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import {
  findUserById,
  findUserByUsername,
  toPublicUser,
} from "./users-dao.js";

function verifyPassword(user, password) {
  const storedHash = Buffer.from(user.password_hash, "hex");
  const suppliedHash = scryptSync(password, user.salt, storedHash.length);

  return timingSafeEqual(storedHash, suppliedHash);
}

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await findUserByUsername(username);

      if (!user || !verifyPassword(user, password)) {
        done(null, false, { message: "Incorrect username or password." });
        return;
      }

      done(null, toPublicUser(user));
    } catch (error) {
      done(error);
    }
  }),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    done(null, user ? toPublicUser(user) : false);
  } catch (error) {
    done(error);
  }
});

export function requireAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
    return;
  }

  res.status(401).json({ error: "Authentication required." });
}

export default passport;
