import { apiFetch } from "./client";

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

  // Bug fix: this was a bare `res.json()`, the one spot in the codebase that
  // didn't guard against a non-JSON/empty body (every other raw-fetch caller,
  // and the shared apiFetch, already does `.catch(() => null)`). A dropped
  // connection with no body -- possible even now that auth.controller.ts has
  // try/catch everywhere, e.g. a real network drop -- surfaced as a raw
  // "Failed to execute 'json' on 'Response'" browser error straight on the
  // login screen instead of a normal error message.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error((data && data.error) || "Invalid email or password");
  }
  if (!data) {
    throw new Error("Could not reach the server. Please try again.");
  }

  return data as LoginResponse;
}

export function loginRequest(email: string, password: string) {
  return postLogin("/login", email, password);
}

export function adminLoginRequest(email: string, password: string) {
  return postLogin("/admin-login", email, password);
}

// Re-confirms the current user's own password mid-session (no new token).
// Used by IT Admin's "type your password to confirm" steps.
export function verifyPassword(password: string) {
  return apiFetch<{ verified: true }>("/auth/verify-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// Backend always returns the same generic message whether or not the email
// actually exists (so this endpoint can't be used to enumerate accounts) --
// the frontend just displays whatever message comes back, it doesn't infer
// success/failure from it.
export function forgotPasswordRequest(email: string) {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordRequest(token: string, newPassword: string) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}
