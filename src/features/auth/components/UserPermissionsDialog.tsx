"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchUserPermissions,
  saveUserPermissionsRequest,
} from "@/features/auth/services/users-client.service";
import { PAGE_KEYS, PAGE_PERMISSION_SCHEMA } from "@/features/auth/permissions-schema";
import type { ManagedUser, PageKey, PageOperation, UserPermission } from "@/features/auth/types";

function permissionKey(pageKey: PageKey, operation: PageOperation) {
  return `${pageKey}:${operation}`;
}

// Every operation key across a page and its subcategories, e.g. the "select
// all" checkbox for Style Bulletin also covers its Attachments subcategory.
function allKeysForPage(pageKey: PageKey): string[] {
  const page = PAGE_PERMISSION_SCHEMA[pageKey];
  if (!page) return [];
  const own = page.operations.map((op) => permissionKey(pageKey, op.key));
  const nested = (page.subcategories ?? []).flatMap((sub) =>
    sub.operations.map((op) => permissionKey(sub.key, op.key)),
  );
  return [...own, ...nested];
}

export function UserPermissionsDialog({
  user,
  onOpenChange,
}: {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<PageKey>>(new Set());

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    fetchUserPermissions(user.id)
      .then((permissions) => {
        setGranted(new Set(permissions.map((p) => permissionKey(p.pageKey, p.operation))));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load permissions."))
      .finally(() => setLoading(false));
  }, [user]);

  function toggle(pageKey: PageKey, operation: PageOperation) {
    const key = permissionKey(pageKey, operation);
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllForPage(pageKey: PageKey, checked: boolean) {
    const keys = allKeysForPage(pageKey);
    setGranted((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function toggleCollapsed(pageKey: PageKey) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(pageKey)) next.delete(pageKey);
      else next.add(pageKey);
      return next;
    });
  }

  const grantedCount = granted.size;

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const permissions: UserPermission[] = [...granted].map((key) => {
        const [pageKey, operation] = key.split(":") as [PageKey, PageOperation];
        return { pageKey, operation };
      });
      await saveUserPermissionsRequest(user.id, permissions);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="max-w-3xl gap-0">
        <DialogHeader>
          <DialogTitle>Permissions</DialogTitle>
          <DialogDescription>
            {user?.displayName} <span className="text-muted-foreground/70">· {user?.email}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-border max-h-[60vh] overflow-y-auto">
            {PAGE_KEYS.map((pageKey) => (
              <PageRow
                key={pageKey}
                pageKey={pageKey}
                granted={granted}
                collapsed={collapsed.has(pageKey)}
                onToggleCollapsed={() => toggleCollapsed(pageKey)}
                onToggle={toggle}
                onToggleAll={toggleAllForPage}
              />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}

        <DialogFooter className="mt-5 items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {grantedCount === 0 ? "No permissions granted" : `${grantedCount} granted`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || loading} onClick={handleSave}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OperationCheckboxes({
  pageKey,
  operations,
  granted,
  onToggle,
}: {
  pageKey: PageKey;
  operations: { key: PageOperation; label: string }[];
  granted: Set<string>;
  onToggle: (pageKey: PageKey, operation: PageOperation) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {operations.map((op) => (
        <label
          key={op.key}
          className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
        >
          <Checkbox
            checked={granted.has(permissionKey(pageKey, op.key))}
            onCheckedChange={() => onToggle(pageKey, op.key)}
          />
          {op.label}
        </label>
      ))}
    </div>
  );
}

function PageRow({
  pageKey,
  granted,
  collapsed,
  onToggleCollapsed,
  onToggle,
  onToggleAll,
}: {
  pageKey: PageKey;
  granted: Set<string>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggle: (pageKey: PageKey, operation: PageOperation) => void;
  onToggleAll: (pageKey: PageKey, checked: boolean) => void;
}) {
  const page = PAGE_PERMISSION_SCHEMA[pageKey];
  const allKeys = useMemo(() => allKeysForPage(pageKey), [pageKey]);

  if (!page) return null;

  const grantedInPage = allKeys.filter((k) => granted.has(k)).length;
  const allGranted = allKeys.length > 0 && grantedInPage === allKeys.length;
  const someGranted = grantedInPage > 0 && !allGranted;

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3 px-1 py-1">
        <Checkbox
          checked={allGranted}
          indeterminate={someGranted}
          onCheckedChange={(checked) => onToggleAll(pageKey, !!checked)}
        />
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex flex-1 items-center gap-2 text-left cursor-pointer group"
        >
          <ChevronDown
            className={`size-3.5 text-muted-foreground/60 transition-transform group-hover:text-muted-foreground ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="text-sm font-medium">{page.label}</span>
          <span className="text-xs text-muted-foreground/70 tabular-nums">
            {grantedInPage}/{allKeys.length}
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="pl-9 pt-1.5 flex flex-col gap-3">
          <OperationCheckboxes
            pageKey={pageKey}
            operations={page.operations}
            granted={granted}
            onToggle={onToggle}
          />

          {page.subcategories?.map((sub) => (
            <div key={sub.key} className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground/80">{sub.label}</span>
              <OperationCheckboxes
                pageKey={sub.key}
                operations={sub.operations}
                granted={granted}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
