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

// R-12 in the risk register, investigated: os.loadavg() is a real 1-minute
// load average on Linux/macOS -- which is what this app actually runs on in
// production (Render) -- confirmed working there already (the System
// Monitoring page has shown real, changing values like 65% and 71% on the
// live deployment). The described risk had it backwards: Node always
// reports loadavg() as [0, 0, 0] on WINDOWS specifically (a Node/libuv
// limitation with no workaround), which only affects a developer's local
// Windows machine, not the deployed target. Previously this surfaced as a
// silent, indistinguishable-from-real 0%, which could be misread as
// "genuinely idle" rather than "not measurable here" -- now returns null on
// an unsupported platform instead, so the caller/UI can show "Not available"
// rather than a misleading number.
export function getServerLoadPercent(): number | null {
  if (os.platform() === "win32") return null;
  const oneMinuteLoad = os.loadavg()[0] ?? 0;
  const cpuCount = os.cpus().length || 1;
  const percent = (oneMinuteLoad / cpuCount) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
