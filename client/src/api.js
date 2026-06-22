const API_BASE_URL = "http://localhost:3001";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error ?? "The request failed.");
  }

  return body;
}

export function getCurrentUser() {
  return request("/api/sessions/current");
}

export function login(credentials) {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function logout() {
  return request("/api/sessions/current", {
    method: "DELETE",
  });
}

export function getFullNetwork() {
  return request("/api/network/full");
}

export function createGame() {
  return request("/api/games", {
    method: "POST",
  });
}

export function getGame(gameId) {
  return request(`/api/games/${gameId}`);
}

export function getPlanningData(gameId) {
  return request(`/api/games/${gameId}/planning`);
}

export function submitRoute(gameId, selectedSegmentIds) {
  return request(`/api/games/${gameId}/route`, {
    method: "POST",
    body: JSON.stringify({ selectedSegmentIds }),
  });
}

export function getExecutionData(gameId) {
  return request(`/api/games/${gameId}/execution`);
}

export function getResultData(gameId) {
  return request(`/api/games/${gameId}/result`);
}

export function getRanking() {
  return request("/api/ranking");
}
