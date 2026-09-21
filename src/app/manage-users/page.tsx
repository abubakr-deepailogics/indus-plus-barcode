"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/features/auth/context/auth-context";
import { useManageUsersFacade } from "@/features/auth/hooks/useManageUsersFacade";
import { CreateUserDialog } from "@/features/auth/components/CreateUserDialog";
import { ResetPasswordResultDialog } from "@/features/auth/components/ResetPasswordResultDialog";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { ManagedUser } from "@/features/auth/types";

const pillButtonClassName =
  "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export default function ManageUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { users, loading, error, createUser, toggleAdmin, toggleActive, resetPassword } =
    useManageUsersFacade();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<ManagedUser>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        accessorKey: "displayName",
        header: "Name",
      },
      {
        accessorKey: "isAdmin",
        header: "Admin",
        size: 90,
        cell: ({ row }) => (row.original.isAdmin ? "Yes" : "No"),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        size: 100,
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
              row.original.isActive
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {row.original.isActive ? "Active" : "Disabled"}
          </span>
        ),
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last login",
        size: 170,
        cell: ({ row }) =>
          row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleString() : "Never",
      },
      {
        id: "actions",
        header: "Actions",
        size: 340,
        cell: ({ row }) => {
          const u = row.original;
          const isSelf = u.id === currentUser?.id;
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${pillButtonClassName} ${
                  u.isAdmin
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                }`}
                disabled={isSelf}
                onClick={async () => {
                  setActionError(null);
                  try {
                    await toggleAdmin(u);
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Action failed.");
                  }
                }}
              >
                {u.isAdmin ? "Revoke admin" : "Make admin"}
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} ${
                  u.isActive
                    ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                }`}
                disabled={isSelf}
                onClick={async () => {
                  setActionError(null);
                  try {
                    await toggleActive(u);
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Action failed.");
                  }
                }}
              >
                {u.isActive ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700`}
                onClick={async () => {
                  setActionError(null);
                  try {
                    const { temporaryPassword } = await resetPassword(u);
                    setTemporaryPassword(temporaryPassword);
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Action failed.");
                  }
                }}
              >
                Reset password
              </button>
            </div>
          );
        },
      },
    ],
    [currentUser?.id, toggleAdmin, toggleActive, resetPassword],
  );

  if (authLoading) return null;

  if (!currentUser?.isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manage users</h1>
        <CreateUserDialog onCreate={createUser} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      <DataTable columns={columns} data={users} isLoading={loading} />
      <ResetPasswordResultDialog
        temporaryPassword={temporaryPassword}
        onClose={() => setTemporaryPassword(null)}
      />
    </div>
  );
}
