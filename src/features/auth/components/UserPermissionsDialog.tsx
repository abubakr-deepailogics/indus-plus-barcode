"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Scissors,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ALLOWED_OPERATIONS_BY_PAGE_KEY,
  PAGE_KEYS,
  PAGE_KEYS_BY_DEPARTMENT,
  PAGE_PERMISSION_SCHEMA,
} from "@/features/auth/permissions-schema";
import {
  fetchUserPermissions,
  saveUserPermissionsRequest,
} from "@/features/auth/services/users-client.service";
import type {
  ManagedUser,
  PageKey,
  PageOperation,
  PermissionDepartment,
  UserPermission,
} from "@/features/auth/types";

const PERMISSION_DEPARTMENTS: { id: PermissionDepartment; label: string }[] = [
  { id: "sewing", label: "Sewing" },
  { id: "washing", label: "Washing" },
  { id: "finishing", label: "Finishing" },
];

const PAGE_ICONS: Record<PageKey, LucideIcon> = {
  "cut-report": Scissors,
  "washing-cut-report": Droplets,
  "style-bulletin": ClipboardList,
  "style-bulletin-attachments": Paperclip,
  "coupon-generation": QrCode,
  "coupon-scanning": ScanLine,
  "coupon-tracing": Search,
  "coupon-tracing-unscan": RotateCcw,
  "rework-coupon": RotateCcw,
  reports: BarChart3,
  "manage-users": Users,
};

const PAGE_DESCRIPTIONS: Record<PageKey, string> = {
  "cut-report": "View production cutting details.",
  "washing-cut-report": "View, enter, and remove Washing cut rows.",
  "style-bulletin": "View order operations and bulletin information.",
  "style-bulletin-attachments": "View and manage bulletin files.",
  "coupon-generation": "Create and print production coupons.",
  "coupon-scanning": "Record employee production scans.",
  "coupon-tracing": "Find coupons and manage coupon records.",
  "coupon-tracing-unscan": "Reverse coupon scans when permitted.",
  "rework-coupon": "Create coupons for rework bundles.",
  reports: "View production and wage reports.",
  "manage-users": "Manage user accounts and access.",
};

const OPERATION_ICONS: Record<PageOperation, LucideIcon> = {
  read: Eye,
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const OPERATION_DESCRIPTIONS: Record<PageOperation, string> = {
  read: "Open this area and view its information.",
  create: "Add or create records in this area.",
  update: "Change existing information.",
  delete: "Remove records from this area.",
};

const ALL_PERMISSION_KEYS = PERMISSION_DEPARTMENTS.flatMap(({ id: department }) =>
  PAGE_KEYS_BY_DEPARTMENT[department].flatMap((pageKey) =>
    (ALLOWED_OPERATIONS_BY_PAGE_KEY[pageKey] ?? []).map(
      (operation) => `${department}:${pageKey}:${operation}`,
    ),
  ),
);
const ALL_PERMISSION_SET = new Set(ALL_PERMISSION_KEYS);

function permissionKey(department: PermissionDepartment, pageKey: PageKey, operation: PageOperation): string {
  return `${department}:${pageKey}:${operation}`;
}

function allKeysForPage(department: PermissionDepartment, pageKey: PageKey): string[] {
  const page = PAGE_PERMISSION_SCHEMA[pageKey];
  if (!page) return [];
  const own = page.operations.map((operation) =>
    permissionKey(department, pageKey, operation.key),
  );
  const nested = (page.subcategories ?? []).flatMap((subcategory) =>
    subcategory.operations.map((operation) =>
      permissionKey(department, subcategory.key, operation.key),
    ),
  );
  return [...own, ...nested];
}

function setsMatch(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((key) => right.has(key));
}

function matchesSearch(pageKey: PageKey, query: string): boolean {
  if (!query) return true;
  const page = PAGE_PERMISSION_SCHEMA[pageKey];
  if (!page) return false;
  const searchable = [
    page.label,
    PAGE_DESCRIPTIONS[pageKey],
    ...page.operations.map((operation) => operation.label),
    ...(page.subcategories ?? []).flatMap((subcategory) => [
      subcategory.label,
      ...subcategory.operations.map((operation) => operation.label),
    ]),
  ];
  return searchable.some((value) => value.toLowerCase().includes(query));
}

function operationDescription(
  pageKey: PageKey,
  operation: PageOperation,
): string {
  if (pageKey === "coupon-tracing-unscan" && operation === "create") {
    return "Reverse an eligible coupon scan. Wage-locked coupons stay protected.";
  }
  if (pageKey === "washing-cut-report" && operation === "delete") {
    return "Remove a saved cut row while keeping its audit history.";
  }
  return OPERATION_DESCRIPTIONS[operation];
}

function initialsFor(user: ManagedUser): string {
  const name = user.displayName.trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function UserPermissionsDialog({
  user,
  onOpenChange,
}: {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [loadedRequest, setLoadedRequest] = useState<{
    userId: number;
    version: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<{
    userId: number;
    version: number;
    message: string;
  } | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState<PageKey>(PAGE_KEYS[0]);
  const [selectedDepartment, setSelectedDepartment] = useState<PermissionDepartment>("sewing");

  const userId = user?.id;
  useEffect(() => {
    if (userId == null) return;
    let current = true;

    fetchUserPermissions(userId)
      .then((permissions) => {
        if (!current) return;
        const next = new Set(
          permissions.map((permission) =>
            permissionKey(permission.department, permission.pageKey, permission.operation),
          ),
        );
        setGranted(next);
        setOriginal(next);
        setSelectedPage(PAGE_KEYS[0]);
        setSelectedDepartment("sewing");
        setSearch("");
        setSaveError(null);
        setLoadError(null);
        setLoadedRequest({ userId, version: reloadVersion });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setLoadError({
          userId,
          version: reloadVersion,
          message:
            error instanceof Error
              ? error.message
              : "Could not load this user's permissions.",
        });
        setLoadedRequest({ userId, version: reloadVersion });
      });

    return () => {
      current = false;
    };
  }, [userId, reloadVersion]);

  const isLoading =
    userId != null &&
    (loadedRequest?.userId !== userId ||
      loadedRequest.version !== reloadVersion);
  const currentLoadError =
    loadError?.userId === userId && loadError?.version === reloadVersion
      ? loadError.message
      : null;
  const isAdmin = user?.isAdmin ?? false;
  const effectiveGranted = isAdmin ? ALL_PERMISSION_SET : granted;
  const departmentPermissionKeys = ALL_PERMISSION_KEYS.filter((key) => key.startsWith(`${selectedDepartment}:`));
  const departmentGrantedCount = departmentPermissionKeys.filter((key) => effectiveGranted.has(key)).length;
  const isDirty = !setsMatch(granted, original);
  const filteredPages = PAGE_KEYS_BY_DEPARTMENT[selectedDepartment].filter((pageKey) =>
    matchesSearch(pageKey, search.trim().toLowerCase()),
  );
  const activePageKey = filteredPages.includes(selectedPage)
    ? selectedPage
    : filteredPages[0];
  const activePage = activePageKey
    ? PAGE_PERMISSION_SCHEMA[activePageKey]
    : undefined;
  const activePageKeys = activePageKey ? allKeysForPage(selectedDepartment, activePageKey) : [];
  const activePageGranted = activePageKeys.filter((key) =>
    effectiveGranted.has(key),
  ).length;
  const activePageAllGranted =
    activePageKeys.length > 0 && activePageGranted === activePageKeys.length;
  const activePageSomeGranted = activePageGranted > 0 && !activePageAllGranted;
  const controlsDisabled = isLoading || !!currentLoadError || saving || isAdmin;

  function setPermission(
    pageKey: PageKey,
    operation: PageOperation,
    checked: boolean,
  ) {
    const key = permissionKey(selectedDepartment, pageKey, operation);
    setGranted((previous) => {
      const next = new Set(previous);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function setPagePermissions(pageKey: PageKey, checked: boolean) {
    setGranted((previous) => {
      const next = new Set(previous);
      for (const key of allKeysForPage(selectedDepartment, pageKey)) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function closeDialog() {
    if (saving) return;
    setGranted(new Set(original));
    setSaveError(null);
    setLoadError(null);
    setLoadedRequest(null);
    setSearch("");
    onOpenChange(false);
  }

  async function savePermissions() {
    if (!user || isAdmin || !isDirty || isLoading || currentLoadError) return;
    setSaving(true);
    setSaveError(null);
    try {
      const permissions: UserPermission[] = [...granted].map((key) => {
        const [department, pageKey, operation] = key.split(":") as [PermissionDepartment, PageKey, PageOperation];
        return { department, pageKey, operation };
      });
      await saveUserPermissionsRequest(user.id, permissions);
      setOriginal(new Set(granted));
      setLoadedRequest(null);
      setLoadError(null);
      onOpenChange(false);
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save permissions.",
      );
    } finally {
      setSaving(false);
    }
  }

  function reloadPermissions() {
    if (!user || saving) return;
    setLoadedRequest(null);
    setLoadError(null);
    setReloadVersion((version) => version + 1);
  }

  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) closeDialog();
      }}
    >
      <DialogContent
        data-client-brand
        showCloseButton={false}
        className="flex h-[88dvh] max-h-[780px] min-h-[500px] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[1080px]"
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="flex items-start justify-between gap-4 pr-8 sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                  Access control
                </p>
                <DialogTitle className="mt-1 text-lg font-semibold text-slate-950">
                  Page permissions
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Choose which pages and actions this user can access.
                </DialogDescription>
              </div>
            </div>

            {user && (
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white sm:flex">
                  {initialsFor(user)}
                </div>
                <div className="min-w-0 text-right sm:text-left">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {user.displayName || user.email}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {user.email}
                  </div>
                </div>
                <span
                  className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${
                    isAdmin
                      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                      : user.isActive
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {isAdmin
                    ? "Administrator"
                    : user.isActive
                      ? "Active"
                      : "Disabled"}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex max-h-[230px] w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50/80 md:max-h-none md:w-[276px] md:border-b-0 md:border-r">
            <div className="border-b border-slate-200 p-4">
              <label className="sr-only" htmlFor="permission-page-search">
                Search pages and actions
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="permission-page-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search pages or actions"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>{selectedDepartment} access</span>
                <span className="tabular-nums">
                  {isAdmin
                    ? `${departmentPermissionKeys.length} / ${departmentPermissionKeys.length}`
                    : `${departmentGrantedCount} / ${departmentPermissionKeys.length}`}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width]"
                  style={{
                    width: `${(departmentGrantedCount / Math.max(departmentPermissionKeys.length, 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {PERMISSION_DEPARTMENTS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelectedDepartment(id);
                      setSelectedPage(PAGE_KEYS_BY_DEPARTMENT[id][0]);
                    }}
                    className={`rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
                      selectedDepartment === id
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <nav
              aria-label="Permission pages"
              className="flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto"
            >
              {filteredPages.map((pageKey) => {
                const page = PAGE_PERMISSION_SCHEMA[pageKey];
                if (!page) return null;
                const keys = allKeysForPage(selectedDepartment, pageKey);
                const count = keys.filter((key) =>
                  effectiveGranted.has(key),
                ).length;
                const selected = activePageKey === pageKey;
                const Icon = PAGE_ICONS[pageKey];
                return (
                  <button
                    key={pageKey}
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    onClick={() => setSelectedPage(pageKey)}
                    className={`group flex min-w-[190px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors md:min-w-0 ${
                      selected
                        ? "border-indigo-200 bg-white text-indigo-800 shadow-sm"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
                    }`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                        selected
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {page.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-400 tabular-nums">
                        {count} of {keys.length} actions
                      </span>
                    </span>
                    <ChevronRight className="hidden size-3.5 shrink-0 text-slate-300 md:block" />
                  </button>
                );
              })}
              {filteredPages.length === 0 && (
                <div className="flex min-w-[220px] items-center gap-2 px-3 py-5 text-xs text-slate-500 md:min-w-0">
                  <Search className="size-4 shrink-0 text-slate-400" />
                  No matching pages or actions.
                </div>
              )}
            </nav>

            <div className="hidden border-t border-slate-200 p-3 text-[10px] leading-relaxed text-slate-500 md:block">
              Administrators inherit full access. Individual page permissions
              apply to standard accounts.
            </div>
          </aside>

          <section className="flex min-h-0 flex-1 flex-col bg-white">
            {isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="size-6 animate-spin text-indigo-600" />
                Loading permissions...
              </div>
            ) : currentLoadError ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <AlertCircle className="size-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  Permissions could not be loaded
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                  {currentLoadError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={reloadPermissions}
                >
                  <RefreshCw data-icon="inline-start" />
                  Try again
                </Button>
              </div>
            ) : !activePage || !activePageKey ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Search className="size-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  Choose a page
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Clear the search to see all permission areas.
                </p>
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-7">
                  {isAdmin && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-950">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700" />
                      <p>
                        <strong>
                          Administrator accounts have full access.
                        </strong>{" "}
                        Individual permissions are shown as inherited and cannot
                        be changed here.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                        {(() => {
                          const Icon = PAGE_ICONS[activePageKey];
                          return <Icon className="size-5" />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-slate-950">
                          {activePage.label}
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {PAGE_DESCRIPTIONS[activePageKey]}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 tabular-nums">
                      {activePageGranted} of {activePageKeys.length} enabled
                    </span>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={activePageAllGranted}
                        indeterminate={activePageSomeGranted}
                        disabled={controlsDisabled}
                        onCheckedChange={(checked) =>
                          setPagePermissions(activePageKey, checked === true)
                        }
                      />
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">
                          Grant all on this page
                        </span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          Includes nested areas such as attachments or unscan.
                        </span>
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {activePageKeys.length} actions
                    </span>
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                  <PermissionGroup
                    title={`${activePage.label} actions`}
                    department={selectedDepartment}
                    pageKey={activePageKey}
                    operations={activePage.operations}
                    granted={effectiveGranted}
                    disabled={controlsDisabled}
                    onChange={setPermission}
                  />

                  {activePage.subcategories?.map((subcategory) => (
                    <PermissionGroup
                      key={subcategory.key}
                      title={subcategory.label}
                      department={selectedDepartment}
                      pageKey={subcategory.key}
                      operations={subcategory.operations}
                      granted={effectiveGranted}
                      disabled={controlsDisabled}
                      onChange={setPermission}
                      nested
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="min-h-5 text-xs">
            {saveError ? (
              <span className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="size-4 shrink-0" />
                {saveError}
              </span>
            ) : isDirty && !isAdmin ? (
              <span className="flex items-center gap-2 font-medium text-amber-800">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Unsaved permission changes
              </span>
            ) : isAdmin ? (
              <span className="flex items-center gap-2 text-slate-500">
                <ShieldCheck className="size-4" />
                Full access inherited from administrator role
              </span>
            ) : (
              <span className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="size-4" />
                {departmentGrantedCount} of {departmentPermissionKeys.length} {selectedDepartment} actions enabled
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving || !isDirty || isAdmin}
              onClick={() => {
                setGranted(new Set(original));
                setSaveError(null);
              }}
            >
              <RotateCcw data-icon="inline-start" />
              Discard changes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                saving || isLoading || !!currentLoadError || !isDirty || isAdmin
              }
              onClick={savePermissions}
              className="min-w-[124px]"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {saving ? "Saving..." : "Save permissions"}
            </Button>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close permissions dialog"
          title="Close"
          disabled={saving}
          onClick={closeDialog}
          className="absolute right-4 top-4 z-10 text-slate-500 hover:text-slate-900"
        >
          <X className="size-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function PermissionGroup({
  title,
  department,
  pageKey,
  operations,
  granted,
  disabled,
  onChange,
  nested = false,
}: {
  title: string;
  department: PermissionDepartment;
  pageKey: PageKey;
  operations: { key: PageOperation; label: string }[];
  granted: Set<string>;
  disabled: boolean;
  onChange: (
    pageKey: PageKey,
    operation: PageOperation,
    checked: boolean,
  ) => void;
  nested?: boolean;
}) {
  if (operations.length === 0) return null;
  return (
    <section className={nested ? "mt-7 border-t border-slate-200 pt-6" : ""}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
          {nested && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              Separate access for this part of the page.
            </p>
          )}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {operations.length} {operations.length === 1 ? "action" : "actions"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {operations.map((operation) => (
          <PermissionOption
            key={operation.key}
            pageKey={pageKey}
            operation={operation}
            checked={granted.has(permissionKey(department, pageKey, operation.key))}
            disabled={disabled}
            onChange={(checked) => onChange(pageKey, operation.key, checked)}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionOption({
  pageKey,
  operation,
  checked,
  disabled,
  onChange,
}: {
  pageKey: PageKey;
  operation: { key: PageOperation; label: string };
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const Icon =
    pageKey === "coupon-tracing-unscan" && operation.key === "create"
      ? RotateCcw
      : OPERATION_ICONS[operation.key];
  return (
    <label
      className={`flex min-h-[82px] cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 ${
        checked
          ? "border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
      }`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
          checked
            ? "bg-indigo-100 text-indigo-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-900">
          {operation.label}
        </span>
        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
          {operationDescription(pageKey, operation.key)}
        </span>
      </span>
      {checked && <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" />}
    </label>
  );
}
