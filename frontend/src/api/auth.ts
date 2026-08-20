const API_BASE = "/api/auth";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

async function postLogin(path: string, email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Invalid email or password");
  }

  return data as LoginResponse;
}

export function loginRequest(email: string, password: string) {
  return postLogin("/login", email, password);
}

export function adminLoginRequest(email: string, password: string) {
  return postLogin("/admin-login", email, password);
}
