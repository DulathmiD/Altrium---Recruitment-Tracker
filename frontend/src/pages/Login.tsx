import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest, forgotPasswordRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import AltriumLogo from "../components/AltriumLogo";
import "./Login.css";

const ROLE_ROUTES: Record<string, string> = {
  HR: "/hr/vacancies",
  HIRING_MANAGER: "/hiring-manager/dashboard",
  MANAGEMENT: "/management/dashboard",
  LEADERSHIP_MANAGEMENT: "/leadership-management/dashboard",
  INTERVIEWER: "/interviewer/dashboard",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  // Reuses the email already typed into the main Email field above --
  // no separate input for this.
  async function handleForgotSubmit() {
    setForgotError("");
    if (!email.trim()) {
      setForgotError("Enter your email above first.");
      return;
    }
    setForgotSubmitting(true);
    try {
      const { message } = await forgotPasswordRequest(email.trim());
      setForgotMessage(message);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Could not send the reset link. Try again.");
    } finally {
      setForgotSubmitting(false);
    }
  }

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await loginRequest(email.trim(), password);
      setAuth(token, user);
      navigate(ROLE_ROUTES[user.role] ?? "/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  // One form, two modes: normal login vs. requesting a reset link. Enter
  // key and the submit button both route to whichever mode is active,
  // rather than always trying to log in.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (forgotOpen) {
      void handleForgotSubmit();
    } else {
      void handleLogin();
    }
  }

  return (
    <div className="login-body">
      <div className="login-hex-pattern" aria-hidden="true" />
      <div className="login-wrap">
        <div className="login-brand">
          <AltriumLogo size={56} />
          <h1>Recruitment Tracker</h1>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {!forgotOpen && (
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-password-wrap">
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="login-toggle" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {!forgotOpen && error && <div className="login-alert">{error}</div>}
          {forgotOpen && forgotError && <div className="login-alert">{forgotError}</div>}

          {!forgotOpen && !forgotMessage && (
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Signing in..." : "Log in"}
            </button>
          )}

          {!forgotOpen && !forgotMessage && (
            <button
              type="button"
              className="login-forgot"
              onClick={() => setForgotOpen(true)}
            >
              Forgot Password?
            </button>
          )}

          {forgotOpen && !forgotMessage && (
            <div className="login-forgot-actions">
              <button type="button" className="login-forgot-cancel" onClick={() => setForgotOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="login-forgot-send" disabled={forgotSubmitting}>
                {forgotSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </div>
          )}

          {forgotMessage && <p className="login-forgot-notice">{forgotMessage}</p>}

          <p className="login-footer">IT Admin? <a href="/admin">Sign in here</a> instead.</p>
        </form>
      </div>
    </div>
  );
}
