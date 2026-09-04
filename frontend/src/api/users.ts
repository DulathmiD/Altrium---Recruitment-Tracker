import { apiFetch } from "./client";

export type Role = "HR" | "INTERVIEWER" | "MANAGEMENT" | "HIRING_MANAGER" | "IT_ADMIN" | "LEADERSHIP_MANAGEMENT";

// Matches the raw Prisma User row minus the global omit (passwordHash/resetTokenHash/
// resetTokenExpiresAt are stripped server-side for every query, see backend/src/prisma.ts) --
// those fields never reach this client at all.
export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  phoneNumber?: string;
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  department?: string;
};

export function listUsers(filters?: { role?: Role; isActive?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
  const qs = params.toString();
  return apiFetch<User[]>(`/users${qs ? `?${qs}` : ""}`);
}

export function getUser(id: number) {
  return apiFetch<User>(`/users/${id}`);
}

export function createUser(input: CreateUserInput) {
  return apiFetch<User & { phoneNumberSaved: boolean }>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(id: number, input: UpdateUserInput) {
  return apiFetch<User>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setUserActive(id: number, isActive: boolean) {
  return apiFetch<User>(`/users/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function setUserRole(id: number, role: Role) {
  return apiFetch<User>(`/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
