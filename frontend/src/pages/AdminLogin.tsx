import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { adminLoginRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import AltriumLogo from "../components/AltriumLogo";
import "./Login.css";

export default function AdminLogin() {
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
      const { token, user } = await adminLoginRequest(email.trim(), password);
      setAuth(token, user);
      navigate("/admin/users");
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
          <p className="login-brand-subtitle">IT Admin sign in</p>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

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

          {error && <div className="login-alert">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="login-footer"><a href="/login">Back to regular sign in</a></p>
        </form>
      </div>
    </div>
  );
}
