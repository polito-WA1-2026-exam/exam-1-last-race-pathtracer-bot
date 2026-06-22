import { get } from "./db.js";

export function findUserById(id) {
  return get(
    "SELECT id, username, password_hash, salt FROM users WHERE id = ?",
    [id],
  );
}

export function findUserByUsername(username) {
  return get(
    "SELECT id, username, password_hash, salt FROM users WHERE username = ?",
    [username],
  );
}

export function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
  };
}
