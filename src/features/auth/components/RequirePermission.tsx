"use client";

import { useAuth } from "@/features/auth/context/auth-context";
import type { PageKey } from "@/features/auth/types";

export function RequirePermission({
  pageKey,
  children,
}: {
  pageKey: PageKey;
  children: React.ReactNode;
}) {
  const { loading, can } = useAuth();

  if (loading) return null;

  if (!can(pageKey, "read")) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
