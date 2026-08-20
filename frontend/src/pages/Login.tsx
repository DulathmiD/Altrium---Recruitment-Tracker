import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const ROLE_ROUTES: Record<string, string> = {
  HR: "/hr/dashboard",
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
      <div className="login-wrap">
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1>Recruitment System</h1>
          <p>Sign in</p>
        </div>

        <div className="login-card">
          <div className="login-notice">
            <p>One shared sign-in for all roles. You'll be sent to the right dashboard automatically.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" placeholder="name@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-password-wrap">
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                  placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="login-toggle" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <div className="login-alert">{error}</div>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="login-footer">IT Admin? <a href="/admin">Sign in here</a> instead.</p>
        </div>
      </div>
    </div>
  );
}
