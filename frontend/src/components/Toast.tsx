import { useEffect } from "react";
import "./Toast.css";

type ToastProps = {
  message: string;
  /** Auto-dismiss delay in ms. Pass 0 to disable auto-dismiss (manual close only). */
  duration?: number;
  onClose: () => void;
  /** Shows an explicit "x" close button, for toasts that should stay until the user dismisses or reads them. */
  dismissible?: boolean;
  /** "bottom-center" (default) for page-level confirmations; "top-right" for
   * notification-style popups anchored near the bell. Dismissing either
   * variant only hides the popup -- it never implies "read"/"handled" on
   * whatever triggered it, that's a separate, explicit action. */
  position?: "bottom-center" | "top-right";
};

// Popup that auto-dismisses. Used for one-shot confirmations (e.g. "user
// deactivated") that shouldn't sit in the page layout and push content down
// -- it overlays instead, then disappears on its own.
// One consistent look (black, gold accent) for every toast in the app --
// no per-variant colors, no icon. This is the single shared implementation;
// every page-level toast in the system renders through this component so
// the design can't drift between pages.
export default function Toast({ message, duration = 7000, onClose, dismissible = false, position = "bottom-center" }: ToastProps) {
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, duration]);

  return (
    <div className={"toast" + (position === "top-right" ? " toast-top-right" : "")} role="status">
      <span className="toast-message">{message}</span>
      {dismissible && (
        <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
          &#10005;
        </button>
      )}
    </div>
  );
}
