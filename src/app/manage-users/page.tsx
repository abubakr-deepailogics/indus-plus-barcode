"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/features/auth/context/auth-context";
import { useManageUsersFacade } from "@/features/auth/hooks/useManageUsersFacade";
import { CreateUserDialog } from "@/features/auth/components/CreateUserDialog";
import { ResetPasswordResultDialog } from "@/features/auth/components/ResetPasswordResultDialog";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManagedUser } from "@/features/auth/types";

const pillButtonClassName =
  "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export default function ManageUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { users, loading, error, createUser, toggleAdmin, toggleActive, resetPassword, deleteUser } =
    useManageUsersFacade();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<ManagedUser | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

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
        size: 420,
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
                onClick={() => {
                  setActionError(null);
                  setResetConfirmUser(u);
                }}
              >
                Reset password
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700`}
                disabled={isSelf}
                onClick={() => {
                  setActionError(null);
                  setDeleteConfirmUser(u);
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [currentUser?.id, toggleAdmin, toggleActive],
  );

  async function handleConfirmReset() {
    if (!resetConfirmUser) return;
    setActionError(null);
    setResettingPassword(true);
    try {
      const { temporaryPassword } = await resetPassword(resetConfirmUser);
      setTemporaryPassword(temporaryPassword);
      setResetConfirmUser(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmUser) return;
    setActionError(null);
    setDeletingUser(true);
    try {
      await deleteUser(deleteConfirmUser);
      setDeleteConfirmUser(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setDeletingUser(false);
    }
  }

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
      <Dialog
        open={!!resetConfirmUser}
        onOpenChange={(open) => !open && !resettingPassword && setResetConfirmUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password?</DialogTitle>
            <DialogDescription>
              This immediately invalidates {resetConfirmUser?.email}&apos;s current
              password and replaces it with a new temporary one. They will be
              required to change it on their next sign-in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={resettingPassword}
              onClick={() => setResetConfirmUser(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={resettingPassword} onClick={handleConfirmReset}>
              {resettingPassword ? "Resetting..." : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteConfirmUser}
        onOpenChange={(open) => !open && !deletingUser && setDeleteConfirmUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This permanently deletes {deleteConfirmUser?.email}&apos;s account.
              They will no longer be able to sign in. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingUser}
              onClick={() => setDeleteConfirmUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingUser}
              onClick={handleConfirmDelete}
            >
              {deletingUser ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
