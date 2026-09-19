import { apiFetch } from "./client";

export type ActiveUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  lastActiveAt: string | null;
};

export type SystemMetrics = {
  serverLoadPercent: number | null;
  responseTimeMs: number | null;
  concurrentUsers: number;
  // Deliberately a different signal from concurrentUsers above --
  // concurrentUsers counts distinct AuditLog actors (write actions) in the
  // last 5 minutes, this lists actual users with a lastActiveAt (any
  // authenticated request, reads included) within the last 10 minutes. The
  // two numbers can legitimately disagree.
  activeUsers: ActiveUser[];
  backups: {
    status: "not_configured" | "successful" | "failed";
    lastBackupAt: string | null;
    history: { at: string; status: "successful" | "failed"; filename: string; sizeBytes: number }[];
  };
};

export function getSystemMetrics() {
  return apiFetch<SystemMetrics>("/system/metrics");
}

export function runBackupNow() {
  return apiFetch<{ ok: true; filename?: string }>("/system/backups/run", { method: "POST" });
}
