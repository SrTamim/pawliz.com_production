import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authAPI } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
import type { User } from "../types";

/**
 * Auth context provider + hook
 * Manages user session, login/logout, token refresh
 * Provides: user, loading, login, register, logout, isAdmin, isVet
 */

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (data: Record<string, any>) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateUser: (updatedUser: Partial<User>) => void;
  can: (key: string) => boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isVet: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider: fetch user on mount, manage session
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authAPI.me();
        if (!cancelled) setUser(res.user);
      } catch {
        // /auth/me is excluded from the api layer's auto-refresh (see lib/api.ts),
        // so a cold load with an expired access token but a valid refresh cookie
        // would otherwise resolve to null and bounce the user off gated pages.
        // Attempt a one-shot refresh, then retry me() before giving up.
        try {
          await authAPI.refresh();
          const res = await authAPI.me();
          if (!cancelled) setUser(res.user);
        } catch {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phone: string, password: string, rememberMe = false) => {
    const res = await authAPI.login(phone, password, rememberMe);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: Record<string, any>) => {
    const res = await authAPI.register(data);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    // If the server call fails, still clear client state; tokens expire server-side (15min access).
    try { await authAPI.logout(); } catch (err: any) { console.warn("Server logout failed; clearing local session anyway", err); }
    setUser(null);
    disconnectSocket(); // Close stale WS connection — next user gets a fresh socket
    // Clear cached API responses from service worker — prevents PII leakage on shared devices
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try { await authAPI.logoutAll(); } catch {}
    setUser(null);
    disconnectSocket(); // Close stale WS connection — next user gets a fresh socket
    // Clear cached API responses from service worker — prevents PII leakage on shared devices
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      setUser(res.user);
      return res.user;
    } catch {
      return null;
    }
  }, []);

  const updateUser = useCallback((updatedUser: Partial<User>) => {
    // Drop undefined keys so a partial update can't blank existing fields
    const patch = Object.fromEntries(
      Object.entries(updatedUser || {}).filter(([, v]) => v !== undefined),
    );
    setUser((prev: any) => ({ ...(prev as User), ...patch }));
  }, []);

  // RBAC: does the current user hold permission `key`?
  // - admin → always true (superuser).
  // - page key ("users") → granted if in permissions.pages.
  // - action key ("users.delete") → granted only if in permissions.ui AND its
  //   parent page is granted (mirrors backend hasPermission; FE gate is cosmetic,
  //   backend enforces independently).
  const can = useCallback(
    (key: string) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      const perms = user.permissions || ({} as NonNullable<User["permissions"]>);
      const pages = Array.isArray(perms.pages) ? perms.pages : [];
      const ui = Array.isArray(perms.ui) ? perms.ui : [];
      if (key.includes(".")) {
        const parent = key.slice(0, key.indexOf("."));
        return pages.includes(parent) && ui.includes(key);
      }
      return pages.includes(key);
    },
    [user],
  );

  // Can the user open the admin dashboard at all (admin OR ≥1 page permission)?
  const isStaff =
    user?.role === "admin" ||
    (Array.isArray(user?.permissions?.pages) && (user!.permissions!.pages.length > 0));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        logoutAll,
        refreshUser,
        updateUser,
        can,
        isStaff,
        isAdmin: user?.role === "admin",
        isVet: user?.role === "vet",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Use auth context
 */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
