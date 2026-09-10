import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { changePasswordRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import AltriumLogo from "../components/AltriumLogo";
import "./Login.css";

// Reachable two ways: forced, when ProtectedRoute redirects here because
// user.mustChangePassword is still true (an IT-Admin-created account's first
// login on its shared initial password), or later voluntarily from a
// settings link if one gets added. Same form either way -- current password
// required in both cases, this isn't a token-based reset.
//
// On success this logs the account out and sends them back to /login rather
// than continuing straight into the app -- matches ResetPasswordPage's own
// "done" pattern (confirm, then log back in with the new password) instead
// of silently swapping the password out from under an active session.
export default function ChangePasswordPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword) {
      setError("Both fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);
    try {
      await changePasswordRequest(currentPassword, newPassword);
      setDone(true);
      logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password. Please try again.");
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
          <h1>Set a new password</h1>
        </div>

        <div className="login-card">
          {done ? (
            <>
              <p className="login-forgot-notice" style={{ marginBottom: 16 }}>
                Password changed. Log back in with your new password.
              </p>
              <button type="button" className="login-button" onClick={() => navigate("/login", { replace: true })}>
                Back to log in
              </button>
            </>
          ) : (
            <>
              {user.mustChangePassword && (
                <p className="login-forgot-notice" style={{ marginBottom: 16 }}>
                  Your account was created with a temporary password. Set your own before continuing.
                </p>
              )}

              <form onSubmit={handleSubmit}>
                <div className="login-field">
                  <label htmlFor="current-password">Current password</label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

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
                  {loading ? "Changing..." : "Change password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
