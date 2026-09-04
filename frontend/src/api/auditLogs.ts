import { apiFetch } from "./client";

export type AuditLog = {
  id: number;
  createdAt: string;
  user: { id: number; name: string } | null;
  eventType: string;
  description: string;
};

export type AuditLogFilters = {
  eventType?: string;
  from?: string;
  to?: string;
};

// Backend caps this at 200 rows (no pagination yet) -- see the note in AuditLogsPage
// about the "showing most recent 200" hint when the result set hits that ceiling.
export function listAuditLogs(filters?: AuditLogFilters) {
  const params = new URLSearchParams();
  if (filters?.eventType) params.set("eventType", filters.eventType);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  const qs = params.toString();
  return apiFetch<AuditLog[]>(`/audit-logs${qs ? `?${qs}` : ""}`);
}

export function listAuditEventTypes() {
  return apiFetch<{ eventTypes: string[] }>("/audit-logs/event-types");
}
