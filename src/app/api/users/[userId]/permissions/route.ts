import { requireAdminSession, AuthError } from "@/lib/require-session";
import {
  getPermissionsForUser,
  replacePermissionsForUser,
} from "@/features/auth/services/user-permissions.service";
import { ALLOWED_OPERATIONS_BY_PAGE_KEY } from "@/features/auth/permissions-schema";
import type { PermissionDepartment, UserPermission } from "@/features/auth/types";

const PERMISSION_DEPARTMENTS: readonly PermissionDepartment[] = ["sewing", "washing", "finishing"];

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdminSession();
    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    const permissions = await getPermissionsForUser(userId);
    return Response.json(permissions);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("list user permissions failed", err);
    return Response.json({ error: "Failed to load permissions." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdminSession();
    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    let body: { permissions?: UserPermission[] };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const permissions = body.permissions;
    if (!Array.isArray(permissions)) {
      return Response.json({ error: "permissions must be an array." }, { status: 400 });
    }

    const valid = permissions.every(
      (p) =>
        p &&
        PERMISSION_DEPARTMENTS.includes(p.department as PermissionDepartment) &&
        typeof p.pageKey === "string" &&
        ALLOWED_OPERATIONS_BY_PAGE_KEY[p.pageKey as keyof typeof ALLOWED_OPERATIONS_BY_PAGE_KEY]?.includes(
          p.operation,
        ),
    );
    if (!valid) {
      return Response.json({ error: "One or more permissions are invalid." }, { status: 400 });
    }

    await replacePermissionsForUser(userId, permissions);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("update user permissions failed", err);
    return Response.json({ error: "Failed to update permissions." }, { status: 500 });
  }
}
