import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordRequest } from "../api/auth";
import AltriumLogo from "../components/AltriumLogo";
import "./Login.css";

// Landing page for the link sent by POST /auth/forgot-password
// (http://.../reset-password?token=...). Reuses Login.css's classes --
// same card/field/button look, no need for a parallel stylesheet.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token -- use the link from the email exactly as sent.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordRequest(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-body">
      <div className="login-hex-pattern" aria-hidden="true" />
      <div className="login-wrap">
        <div className="login-brand">
          <AltriumLogo size={56} />
          <h1>Reset your password</h1>
        </div>

        <div className="login-card">
          {done ? (
            <>
              <p className="login-forgot-notice" style={{ marginBottom: 16 }}>
                Password has been reset. You can now log in with your new password.
              </p>
              <button type="button" className="login-button" onClick={() => navigate("/login")}>
                Back to log in
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="login-field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && <div className="login-alert">{error}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
