// Hamburger toggle shown only in the mobile top-bar (see the
// max-width:768px block in index.css) -- .layout-menu-btn is display:none
// by default (desktop), so this renders nothing visible at all on a
// laptop/desktop screen no matter where it's mounted.
export default function MobileMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="layout-menu-btn"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
        {open ? (
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <>
            <rect x="3" y="5" width="18" height="2.6" rx="1.3" fill="currentColor" />
            <rect x="3" y="10.7" width="18" height="2.6" rx="1.3" fill="currentColor" />
            <rect x="3" y="16.4" width="18" height="2.6" rx="1.3" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
