import type { PageKey, PageOperation } from "@/features/auth/types";

type OperationDef = { key: PageOperation; label: string };
type SubcategoryDef = { key: PageKey; label: string; operations: OperationDef[] };
type PageDef = { label: string; operations: OperationDef[]; subcategories?: SubcategoryDef[] };

export const PAGE_PERMISSION_SCHEMA: Partial<Record<PageKey, PageDef>> = {
  "cut-report": {
    label: "Cut Report",
    operations: [{ key: "read", label: "View" }],
  },
  "washing-cut-report": {
    label: "Washing Cut Report",
    operations: [
      { key: "read", label: "View" },
      { key: "create", label: "Create" },
      { key: "delete", label: "Delete" },
    ],
  },
  "style-bulletin": {
    label: "Style Bulletin",
    operations: [{ key: "read", label: "View" }],
    subcategories: [
      {
        key: "style-bulletin-attachments",
        label: "Attachments",
        operations: [
          { key: "read", label: "View" },
          { key: "create", label: "Add" },
          { key: "delete", label: "Delete" },
        ],
      },
    ],
  },
  "coupon-generation": {
    label: "Coupon Generation",
    operations: [
      { key: "read", label: "View" },
      { key: "create", label: "Create" },
    ],
  },
  "coupon-scanning": {
    label: "Coupon Scanning",
    operations: [
      { key: "read", label: "View" },
      { key: "create", label: "Create" },
    ],
  },
  "coupon-tracing": {
    label: "Coupon Tracing",
    operations: [
      { key: "read", label: "View" },
      { key: "delete", label: "Delete" },
    ],
    subcategories: [
      {
        key: "coupon-tracing-unscan",
        label: "Unscan",
        operations: [
          { key: "read", label: "View" },
          { key: "create", label: "Unscan" },
        ],
      },
    ],
  },
  "rework-coupon": {
    label: "Rework Coupon",
    operations: [
      { key: "read", label: "View" },
      { key: "create", label: "Create" },
    ],
  },
  reports: {
    label: "Reports",
    operations: [{ key: "read", label: "View" }],
  },
  "manage-users": {
    label: "Manage Users",
    operations: [
      { key: "read", label: "View" },
      { key: "create", label: "Create" },
      { key: "update", label: "Edit" },
      { key: "delete", label: "Delete" },
    ],
  },
};

// Only top-level pages — used to drive the permission editor's page list.
// Subcategories are rendered nested under their parent, not as siblings.
export const PAGE_KEYS = Object.keys(PAGE_PERMISSION_SCHEMA) as PageKey[];

// Flattened page/subcategory -> allowed operations, for validating a
// UserPermission row regardless of whether its pageKey is a top-level page
// or a nested subcategory (both are valid PageKeys for a permission row).
export const ALLOWED_OPERATIONS_BY_PAGE_KEY: Partial<Record<PageKey, PageOperation[]>> = Object.fromEntries(
  Object.entries(PAGE_PERMISSION_SCHEMA).flatMap(([key, def]) => [
    [key, def.operations.map((op) => op.key)],
    ...(def.subcategories ?? []).map((sub) => [sub.key, sub.operations.map((op) => op.key)] as const),
  ]),
);
