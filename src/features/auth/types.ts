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
  pageKey: PageKey;
  operation: PageOperation;
};
