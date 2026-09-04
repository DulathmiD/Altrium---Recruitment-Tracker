import { apiFetch } from "./client";

// Recruitment-relevant roles only -- see backend/src/controllers/staff.controller.ts.
export type StaffRole = "INTERVIEWER" | "MANAGEMENT" | "HIRING_MANAGER";

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
};

// HR-facing staff lookup for assigning a vacancy's interviewer pool or an
// application's Hiring Manager. Deliberately separate from ../api/users.ts,
// which talks to the IT Admin-only /users endpoint -- HR has no access to
// that one.
export function listAssignableStaff(role?: StaffRole) {
  return apiFetch<StaffMember[]>(`/staff${role ? `?role=${role}` : ""}`);
}

// Shared human-readable role label, used anywhere a staff member's role is
// shown next to their name (Assign Interview Panel, Schedule Interview,
// Edit Vacancy panel list) -- "Hiring Manager", not the raw "HIRING_MANAGER"
// enum value or an all-caps "HIRING MANAGER".
const ROLE_LABELS: Record<string, string> = {
  HR: "HR",
  INTERVIEWER: "Interviewer",
  MANAGEMENT: "Management",
  HIRING_MANAGER: "Hiring Manager",
  IT_ADMIN: "IT Admin",
  LEADERSHIP_MANAGEMENT: "Leadership Management",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}
