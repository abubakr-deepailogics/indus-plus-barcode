"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/features/auth/context/auth-context";
import { useManageUsersFacade } from "@/features/auth/hooks/useManageUsersFacade";
import { CreateUserDialog } from "@/features/auth/components/CreateUserDialog";
import { ResetPasswordResultDialog } from "@/features/auth/components/ResetPasswordResultDialog";
import { UserPermissionsDialog } from "@/features/auth/components/UserPermissionsDialog";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CircleCheck,
  CircleX,
  Clock3,
  KeyRound,
  Mail,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
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
  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:pointer-events-none disabled:opacity-40";

export default function ManageUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const {
    users,
    loading,
    error,
    createUser,
    toggleAdmin,
    toggleActive,
    resetPassword,
    deleteUser,
  } = useManageUsersFacade();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<ManagedUser | null>(
    null,
  );
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] =
    useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<ManagedUser | null>(
    null,
  );

  const overview = [
    {
      label: "Accounts",
      value: loading ? "..." : users.length,
      note: "All registered users",
      icon: Users,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "Active",
      value: loading ? "..." : users.filter((user) => user.isActive).length,
      note: "Can sign in",
      icon: CircleCheck,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Administrators",
      value: loading ? "..." : users.filter((user) => user.isAdmin).length,
      note: "Full application access",
      icon: ShieldCheck,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Disabled",
      value: loading ? "..." : users.filter((user) => !user.isActive).length,
      note: "Sign-in is blocked",
      icon: CircleX,
      tone: "bg-rose-50 text-rose-700",
    },
  ];

  const columns = useMemo<ColumnDef<ManagedUser>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        size: 230,
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2.5 text-slate-700">
            <Mail className="size-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{row.original.email}</span>
          </span>
        ),
      },
      {
        accessorKey: "displayName",
        header: "Name",
        size: 180,
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[10px] font-bold uppercase text-indigo-700 ring-1 ring-indigo-100">
              {(row.original.displayName || row.original.email).slice(0, 1)}
            </span>
            <span className="truncate font-medium text-slate-800">
              {row.original.displayName || "-"}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "isAdmin",
        header: "Role",
        size: 135,
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              row.original.isAdmin
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {row.original.isAdmin ? (
              <ShieldCheck className="size-3.5" />
            ) : (
              <Shield className="size-3.5" />
            )}
            {row.original.isAdmin ? "Administrator" : "Standard"}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        size: 125,
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              row.original.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${row.original.isActive ? "bg-emerald-500" : "bg-rose-500"}`}
            />
            {row.original.isActive ? "Active" : "Disabled"}
          </span>
        ),
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last login",
        size: 190,
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <span className="inline-flex items-center gap-2 text-slate-600">
              <Clock3 className="size-3.5 shrink-0 text-slate-400" />
              {new Date(row.original.lastLoginAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-400">Never signed in</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 520,
        cell: ({ row }) => {
          const u = row.original;
          const isSelf = u.id === currentUser?.id;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className={`${pillButtonClassName} ${
                  u.isAdmin
                    ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
                disabled={isSelf}
                title={
                  isSelf
                    ? "You cannot change your own administrator role."
                    : undefined
                }
                onClick={async () => {
                  setActionError(null);
                  try {
                    await toggleAdmin(u);
                  } catch (err) {
                    setActionError(
                      err instanceof Error ? err.message : "Action failed.",
                    );
                  }
                }}
              >
                <ShieldCheck className="size-3.5" />
                {u.isAdmin ? "Revoke admin" : "Make admin"}
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} ${
                  u.isActive
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
                disabled={isSelf}
                title={
                  isSelf ? "You cannot disable your own account." : undefined
                }
                onClick={async () => {
                  setActionError(null);
                  try {
                    await toggleActive(u);
                  } catch (err) {
                    setActionError(
                      err instanceof Error ? err.message : "Action failed.",
                    );
                  }
                }}
              >
                {u.isActive ? (
                  <CircleX className="size-3.5" />
                ) : (
                  <CircleCheck className="size-3.5" />
                )}
                {u.isActive ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`}
                onClick={() => {
                  setActionError(null);
                  setResetConfirmUser(u);
                }}
              >
                <KeyRound className="size-3.5" />
                Reset password
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
                disabled={u.isAdmin}
                title={
                  u.isAdmin
                    ? "Admins have full access to every page."
                    : undefined
                }
                onClick={() => {
                  setActionError(null);
                  setPermissionsUser(u);
                }}
              >
                <SlidersHorizontal className="size-3.5" />
                Permissions
              </button>
              <button
                type="button"
                className={`${pillButtonClassName} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
                disabled={isSelf}
                title={
                  isSelf ? "You cannot delete your own account." : undefined
                }
                onClick={() => {
                  setActionError(null);
                  setDeleteConfirmUser(u);
                }}
              >
                <Trash2 className="size-3.5" />
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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
            <Shield className="size-5" />
          </div>
          <h1 className="mt-4 text-base font-semibold text-slate-900">
            Access restricted
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            You don&apos;t have access to user administration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-client-brand className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
              Administration / Identity
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              Manage users
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage all accounts, sign-in credentials, and department-specific access.
            </p>
          </div>
        </div>
        <CreateUserDialog onCreate={createUser} />
      </header>

      <section
        aria-label="User account overview"
        className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 bg-white sm:grid-cols-4 sm:divide-y-0"
      >
        {overview.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex min-w-0 items-center gap-3 px-3 py-4 sm:px-4"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums text-slate-950">
                    {item.value}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-600">
                    {item.label}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400">
                  {item.note}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {(error || actionError) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error || actionError}</p>
        </div>
      )}

      <section aria-label="User directory" className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Account directory
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Search, review, and manage account access.
            </p>
          </div>
          <span className="hidden rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium tabular-nums text-slate-500 sm:inline-flex">
            {loading
              ? "Loading accounts"
              : `${users.length} ${users.length === 1 ? "account" : "accounts"}`}
          </span>
        </div>
        <DataTable columns={columns} data={users} isLoading={loading} />
      </section>
      <UserPermissionsDialog
        user={permissionsUser}
        onOpenChange={(open) => !open && setPermissionsUser(null)}
      />
      <ResetPasswordResultDialog
        temporaryPassword={temporaryPassword}
        onClose={() => setTemporaryPassword(null)}
      />
      <Dialog
        open={!!resetConfirmUser}
        onOpenChange={(open) =>
          !open && !resettingPassword && setResetConfirmUser(null)
        }
      >
        <DialogContent data-client-brand>
          <DialogHeader>
            <DialogTitle>Reset password?</DialogTitle>
            <DialogDescription>
              This immediately invalidates {resetConfirmUser?.email}&apos;s
              current password and replaces it with a new temporary one. They
              will be required to change it on their next sign-in.
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
            <Button
              type="button"
              disabled={resettingPassword}
              onClick={handleConfirmReset}
            >
              {resettingPassword ? "Resetting..." : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteConfirmUser}
        onOpenChange={(open) =>
          !open && !deletingUser && setDeleteConfirmUser(null)
        }
      >
        <DialogContent data-client-brand>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This permanently deletes {deleteConfirmUser?.email}&apos;s
              account. They will no longer be able to sign in. This cannot be
              undone.
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
