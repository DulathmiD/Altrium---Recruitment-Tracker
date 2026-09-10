const API_BASE = "/api";

// Same `instanceof Error` shape every existing `catch (err) { err instanceof
// Error ? err.message : ... }` call site already checks for -- this doesn't
// change behavior anywhere. `data` carries the full parsed error response
// body (not just the `.error` string) for the few call sites that need more
// than the message, e.g. a duplicate-application 409 that also names the
// existing application's id so the UI can link straight to it.
export class ApiError extends Error {
  data: unknown;
  constructor(message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.data = data;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  // sessionStorage, not localStorage -- see AuthContext.tsx's comment (scoped
  // per-tab so multiple roles can be logged in across tabs at once).
  const token = sessionStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError((data && data.error) || "Something went wrong", data);
  }

  return data as T;
}
