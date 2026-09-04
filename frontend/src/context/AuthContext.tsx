import { createContext, useContext, useState, type ReactNode } from "react";
import type { AuthUser } from "../api/auth";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Bug fix: this used to read/write localStorage, which is shared across
// every tab on the same origin. Logging into a second role in one tab
// silently overwrote the token every OTHER tab was using -- that tab's UI
// kept rendering its old (now-stale) role from React state, but every API
// call it made picked up the freshly-overwritten token, and got a real 403
// from requireRole for the role the token actually belonged to now (this is
// what caused both the Leadership Department Performance 403 and the
// Hiring Manager Dashboard 403 -- same root cause, not two separate bugs).
// sessionStorage is scoped per-tab (a brand new tab gets its own empty copy,
// independent of other tabs), so logging into a different role in one tab no
// longer touches any other tab's session -- multiple roles can now be logged
// in simultaneously across tabs, which is exactly the multi-role-testing
// workflow this project needs. Trade-off: a session no longer survives
// closing and reopening the whole browser (sessionStorage is cleared then) --
// acceptable here, that's normal "log back in" behavior.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = sessionStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  function setAuth(newToken: string, newUser: AuthUser) {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
