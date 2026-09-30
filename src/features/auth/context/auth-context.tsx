"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser, PageKey, PageOperation, UserPermission } from "@/features/auth/types";

type AuthContextValue = {
  user: AuthUser | null;
  permissions: UserPermission[] | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (pageKey: PageKey, operation: PageOperation) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
      setPermissions(data.permissions ?? null);
    } catch {
      setUser(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Catches an idle tab whose account was deleted/disabled or demoted by
    // an admin elsewhere — the cookie itself stays validly signed until it
    // expires, so only a re-check against the DB (via /api/auth/me) can
    // detect that server-side state changed under it.
    const interval = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setPermissions(null);
  }, []);

  // Admins implicitly have every permission (permissions is null for them);
  // everyone else needs an explicit matching (pageKey, operation) grant.
  const can = useCallback(
    (pageKey: PageKey, operation: PageOperation) => {
      if (!user) return false;
      if (user.isAdmin) return true;
      return !!permissions?.some((p) => p.pageKey === pageKey && p.operation === operation);
    },
    [user, permissions],
  );

  return (
    <AuthContext.Provider value={{ user, permissions, loading, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
