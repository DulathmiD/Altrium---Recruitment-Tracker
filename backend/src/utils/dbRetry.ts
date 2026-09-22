// Retries a database operation once, after a short delay, if it throws.
// Mitigates transient connection-pool hiccups -- e.g. a pooled MariaDB
// connection going stale after the app (and its free-tier host) have been
// idle for a while, which is exactly the situation right after a Render
// free-tier web service wakes back up from sleep. Only ever retries once:
// a second failure still propagates to the caller's own try/catch, so a
// genuinely broken query or a real outage still surfaces as an error
// rather than being silently swallowed or retried forever.
export async function withDbRetry<T>(fn: () => Promise<T>, delayMs = 300): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn("DB operation failed, retrying once:", err);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn();
  }
}
