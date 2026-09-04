import { useState } from "react";
import { verifyPassword } from "../api/auth";
import "./PasswordConfirmModal.css";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirmed: () => void | Promise<void>;
  onCancel: () => void;
};

// Shared "type your password to confirm" step. Verifies the password via
// POST /api/auth/verify-password, then runs the caller's action -- if that
// action itself throws (e.g. the underlying deactivate/create call fails),
// the error surfaces in this same modal rather than silently closing it.
export default function PasswordConfirmModal({ title, message, confirmLabel = "Confirm", danger, onConfirmed, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!password) {
      setError("Password is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await verifyPassword(password);
      await onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pwc-backdrop" onClick={onCancel}>
      <div className="pwc-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="pwc-message">{message}</p>

        <label htmlFor="pwc-password">Your Password</label>
        <input
          id="pwc-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          autoFocus
        />

        {error && <p className="pwc-error">{error}</p>}

        <div className="pwc-actions">
          <button className="pwc-cancel-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={"pwc-confirm-btn" + (danger ? " danger" : "")} onClick={handleConfirm} disabled={busy}>
            {busy ? "Checking..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
