export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  mustResetPassword: boolean;
};

export type ManagedUser = {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type CreateUserInput = {
  email: string;
  displayName: string;
  password: string;
  isAdmin: boolean;
};

export type UpdateUserInput = {
  displayName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
};

export type PageOperation = "create" | "read" | "update" | "delete";

// User access is granted independently for each production department. Keep
// this deliberately separate from the UI's broader DepartmentKey (which also
// contains GDP) because only these three departments have this workflow.
export type PermissionDepartment = "sewing" | "washing" | "finishing";

export type PageKey =
  | "cut-report"
  | "washing-cut-report"
  | "style-bulletin"
  | "style-bulletin-attachments"
  | "coupon-generation"
  | "coupon-scanning"
  | "coupon-tracing"
  | "coupon-tracing-unscan"
  | "rework-coupon"
  | "reports"
  | "manage-users";

export type UserPermission = {
  department: PermissionDepartment;
  pageKey: PageKey;
  operation: PageOperation;
};
