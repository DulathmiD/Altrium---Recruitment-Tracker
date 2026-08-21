import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../api/auth";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <div className="login-alert">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Signing in..." : "Log in"}
          </button>

          <button type="button" className="login-forgot" onClick={() => setForgotNotice(true)}>
            Forgot Password?
          </button>
          {forgotNotice && (
            <p className="login-forgot-notice">
              Password reset isn't built into the interface yet — ask your IT Administrator to reset it for you.
            </p>
          )}

          <p className="login-footer">IT Admin? <a href="/admin">Sign in here</a> instead.</p>
        </form>
      </div>
    </div>
  );
}
