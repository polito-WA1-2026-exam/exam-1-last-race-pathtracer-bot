import { all } from "./db.js";

export async function getRanking() {
  const rows = await all(`
    SELECT
      DENSE_RANK() OVER (
        ORDER BY MAX(games.final_score) DESC
      ) AS position,
      users.username,
      MAX(games.final_score) AS best_score
    FROM users
    JOIN games ON users.id = games.user_id
    WHERE games.status = 'completed'
    GROUP BY users.id, users.username
    ORDER BY best_score DESC, users.username ASC
  `);

  return rows.map((row) => ({
    position: row.position,
    username: row.username,
    bestScore: row.best_score,
  }));
}
