"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/context/auth-context";
import AppShell from "@/components/AppShell";

const PUBLIC_ROUTES = ["/login"];
const RESET_PASSWORD_ROUTE = "/account/change-password";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isResetPasswordRoute = pathname === RESET_PASSWORD_ROUTE;
  const mustResetPassword = !!user?.mustResetPassword;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) {
      router.replace("/login");
      return;
    }
    if (user && mustResetPassword && !isResetPasswordRoute) {
      router.replace(RESET_PASSWORD_ROUTE);
      return;
    }
    if (user && isPublicRoute) {
      router.replace(mustResetPassword ? RESET_PASSWORD_ROUTE : "/");
    }
  }, [user, loading, isPublicRoute, isResetPasswordRoute, mustResetPassword, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user && !isPublicRoute) return null;
  if (user && mustResetPassword && !isResetPasswordRoute) return null;
  if (user && isPublicRoute) return null;

  if (isPublicRoute) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
