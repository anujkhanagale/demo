export async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}
