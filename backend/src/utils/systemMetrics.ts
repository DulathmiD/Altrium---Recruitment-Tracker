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
// Windows machine, not the deployed target.
//
// Follow-up: loadavg() being unavailable doesn't mean CPU usage is
// unmeasurable on Windows -- per-core cumulative tick counts (time spent in
// user/nice/sys/idle/irq) ARE available cross-platform via os.cpus(), just
// not pre-averaged into a single rolling figure the way loadavg() is on
// Linux/macOS. Sampling those counters twice, a second apart, and taking
// the delta gives a genuine "percent of CPU time busy across all cores"
// figure for that window -- the same technique the (unmaintained) os-utils
// package uses. A background interval keeps a rolling sample so the
// request handler stays synchronous and instant, same pattern as the
// response-time tracker above; it briefly returns null for about the first
// second after the process starts, before the first sample pair exists.
function sampleCpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  return { idle, total };
}

let windowsLoadPercent: number | null = null;

if (os.platform() === "win32") {
  let previous = sampleCpuTimes();
  setInterval(() => {
    const current = sampleCpuTimes();
    const idleDelta = current.idle - previous.idle;
    const totalDelta = current.total - previous.total;
    previous = current;
    if (totalDelta > 0) {
      const busyPercent = ((totalDelta - idleDelta) / totalDelta) * 100;
      windowsLoadPercent = Math.max(0, Math.min(100, Math.round(busyPercent)));
    }
  }, 1000).unref();
}

export function getServerLoadPercent(): number | null {
  if (os.platform() === "win32") return windowsLoadPercent;
  const oneMinuteLoad = os.loadavg()[0] ?? 0;
  const cpuCount = os.cpus().length || 1;
  const percent = (oneMinuteLoad / cpuCount) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
