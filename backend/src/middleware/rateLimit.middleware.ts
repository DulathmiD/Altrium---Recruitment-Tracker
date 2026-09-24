import rateLimit from "express-rate-limit";

// R-08 in the risk register: login and password-reset endpoints had no cap
// on repeated attempts, so an attacker could brute-force a password or a
// reset code with unlimited tries. These limit by IP address (express-rate-
// limit's default keying), which is coarser than per-account -- a shared
// office/NAT IP could hit the cap for everyone behind it -- but that's a
// deliberate simplicity trade-off for this project's scale rather than an
// oversight; per-account limiting would need its own persisted counter
// table, which is more infrastructure than this risk warrants right now.
//
// Login: 10 attempts per 15 minutes per IP. Loose enough that a genuine
// user mistyping their password a few times never gets blocked, tight
// enough to make online brute-forcing impractical.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait a few minutes and try again." },
});

// Password reset request/confirm: tighter, since these are lower-frequency
// actions for a genuine user than logging in is, and a reset code is a
// direct account-takeover vector if it can be brute-forced.
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset attempts. Please wait a few minutes and try again." },
});
