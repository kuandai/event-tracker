export async function requestJson(state, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.withJson !== false) {
    headers.set("Content-Type", "application/json");
  }
  if (state.auth.token && options.withAuth !== false) {
    headers.set("Authorization", `Bearer ${state.auth.token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || "Request failed.";
    throw new Error(message);
  }
  return payload;
}
