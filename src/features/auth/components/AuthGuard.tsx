"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/context/auth-context";
import { AppShell } from "@/shared/components/AppShell/AppShell";

const PUBLIC_ROUTES = ["/login", "/signup"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) router.replace("/login");
    if (user && isPublicRoute) router.replace("/");
  }, [user, loading, isPublicRoute, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user && !isPublicRoute) return null;
  if (user && isPublicRoute) return null;

  if (isPublicRoute) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
