import os from "os";
import type { Request, Response, NextFunction } from "express";

// Real, if crude, request-latency tracking -- a rolling window of the last
// N request durations, averaged on read. No external monitoring stack
// exists for this project, so this middleware IS the data source for the
// IT Admin Systems page's "Response time" metric.
const WINDOW_SIZE = 200;
const recentDurationsMs: number[] = [];

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    recentDurationsMs.push(durationMs);
    if (recentDurationsMs.length > WINDOW_SIZE) {
      recentDurationsMs.shift();
    }
  });
  next();
}

export function getAverageResponseTimeMs(): number | null {
  if (recentDurationsMs.length === 0) return null;
  const sum = recentDurationsMs.reduce((a, b) => a + b, 0);
  return Math.round(sum / recentDurationsMs.length);
}

// os.loadavg() is a real 1-minute load average on Linux/macOS, but Node
// always reports [0, 0, 0] on Windows (a Node/libuv limitation, not
// something this app can work around) -- so this reads as 0% on a Windows
// dev machine even under load. Flagged rather than faked with a synthetic
// number.
export function getServerLoadPercent(): number {
  const oneMinuteLoad = os.loadavg()[0] ?? 0;
  const cpuCount = os.cpus().length || 1;
  const percent = (oneMinuteLoad / cpuCount) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
