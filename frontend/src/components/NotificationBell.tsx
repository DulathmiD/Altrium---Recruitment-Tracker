import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "../api/notifications";
import Toast from "./Toast";
import "./NotificationBell.css";

// Tracks which notification ids have already popped a toast this browser
// session, so navigating between pages (a fresh NotificationBell mount each
// time, since it lives in each role layout) doesn't re-pop the same alert
// over and over -- each unread notification gets exactly one toast per
// session. Deliberately sessionStorage, not the read/unread state itself:
// dismissing or missing the toast must never mark anything read -- that's
// still only the bell dropdown's job (click the item, or Mark all read).
const TOASTED_KEY = "ntf_toasted_ids";

function getToastedIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(TOASTED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addToastedIds(ids: number[]) {
  try {
    const current = getToastedIds();
    ids.forEach((id) => current.add(id));
    sessionStorage.setItem(TOASTED_KEY, JSON.stringify([...current]));
  } catch {
    // Non-critical -- worst case a toast repeats on the next page.
  }
}

// SCRUM2-31: shared in-app notification bell, fixed to the top-right corner
// of the viewport on every page (see NotificationBell.css) regardless of
// which role layout mounts it. Deliberately no polling/websocket -- fetches
// once on mount, same "fetch on load, no realtime infra" pattern as every
// other screen in this app. Re-fetches when the dropdown opens so it's not
// stale if the user's been on the page a while.
export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    listMyNotifications()
      .then((list) => {
        setNotifications(list);

        // Pop a toast for any unread notification this session hasn't shown
        // yet -- a heads-up, not the source of truth. The item itself stays
        // unread (dot + bold row) in the dropdown regardless of whether this
        // toast is seen, dismissed, or auto-expires.
        const toasted = getToastedIds();
        const fresh = list.filter((n) => !n.read && !toasted.has(n.id));
        const [onlyFresh] = fresh;
        if (fresh.length === 1 && onlyFresh) {
          setPopup(onlyFresh.message);
        } else if (fresh.length > 1) {
          setPopup(`${fresh.length} new notifications`);
        }
        if (fresh.length > 0) {
          addToastedIds(fresh.map((n) => n.id));
        }
      })
      .catch(() => {
        // A failed fetch here shouldn't show an error banner on every page
        // -- just leave the bell showing 0/whatever it last had, same
        // "don't block the rest of the page" spirit as every
        // notification-adjacent failure elsewhere in this app.
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (!open) return;
    load();
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleSelect(n: Notification) {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      } catch {
        // Non-critical -- worst case it stays "unread" until the next load.
      }
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Non-critical -- next load will reflect the real state either way.
    }
  }

  return (
    <div className="ntf-bell-container" ref={containerRef}>
      <button
        type="button"
        className="ntf-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {/* A plain black/white SVG outline instead of the bell emoji glyph --
            the emoji renders in an inconsistent color (and with its own
            internal baseline/padding that never quite centers the same way
            across fonts) depending on the OS, which is what read as "not
            aligned properly" as much as "not black and white". */}
        <svg className="ntf-bell-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a1 1 0 0 1 1 1v1.06A7.002 7.002 0 0 1 19 11v4.586l1.707 1.707A1 1 0 0 1 20 19h-5.09a3 3 0 0 1-5.82 0H4a1 1 0 0 1-.707-1.707L5 15.586V11a7.002 7.002 0 0 1 6-6.94V3a1 1 0 0 1 1-1Zm-1.317 17a1 1 0 0 0 1.732 0h-1.732Z"
          />
        </svg>
        {unreadCount > 0 && <span className="ntf-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="ntf-dropdown">
          <div className="ntf-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="ntf-mark-all-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="ntf-dropdown-list">
            {loading && notifications.length === 0 && <p className="ntf-empty">Loading...</p>}
            {!loading && notifications.length === 0 && <p className="ntf-empty">No notifications yet.</p>}
            {notifications.map((n) => (
              <button
                type="button"
                key={n.id}
                className={"ntf-item" + (n.read ? "" : " ntf-item-unread")}
                onClick={() => handleSelect(n)}
              >
                {!n.read && <span className="ntf-item-dot" />}
                <div className="ntf-item-body">
                  <p className="ntf-item-message">{n.message}</p>
                  <p className="ntf-item-time">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Heads-up only -- auto-dismissing after a few seconds never marks
          anything read. That only happens when the bell is opened and the
          specific item (or "Mark all read") is clicked. */}
      {popup && <Toast message={popup} duration={5000} position="top-right" onClose={() => setPopup(null)} />}
    </div>
  );
}
