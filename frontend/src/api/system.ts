import { apiFetch } from "./client";

export type SystemMetrics = {
  serverLoadPercent: number;
  responseTimeMs: number | null;
  concurrentUsers: number;
  backups: {
    status: "not_configured" | "successful" | "failed";
    lastBackupAt: string | null;
    history: { at: string; status: "successful" | "failed" }[];
  };
};

export function getSystemMetrics() {
  return apiFetch<SystemMetrics>("/system/metrics");
}
