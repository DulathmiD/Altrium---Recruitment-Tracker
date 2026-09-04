const API_BASE = "/api";

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
    throw new Error((data && data.error) || "Something went wrong");
  }

  return data as T;
}
