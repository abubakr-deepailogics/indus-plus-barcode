import { AuthError, requireSession } from "@/lib/require-session";
import { hasPermissionForUser } from "@/features/auth/services/user-permissions.service";
import type { PermissionDepartment } from "@/features/auth/types";
import type { CouponDepartment } from "@/lib/department-classification";

// Arrears alter the settled-pay workflow, so the server enforces this
// separately from the normal Coupon Scanning "Create" permission. The
// session is the authority; client-provided scanBy values are never trusted.
export async function requireArrearsScanningPermission(
  department: CouponDepartment,
): Promise<void> {
  const session = await requireSession();
  if (session.isAdmin) return;

  // Keep the server's department interpretation aligned with useAuth(): GDP
  // currently inherits Sewing permissions. Cutting has no assignable
  // non-admin permission set in Manage Users, so it is intentionally denied
  // instead of accidentally treating another department's grant as valid.
  if (department === "cutting") {
    throw new AuthError("Arrears scanning permission is not configured for Cutting.", 403);
  }
  const permissionDepartment: PermissionDepartment =
    department === "gdp" ? "sewing" : department;

  const permitted = await hasPermissionForUser(
    session.userId,
    permissionDepartment,
    "coupon-scanning-arrears",
    "create",
  );
  if (!permitted) {
    throw new AuthError("You do not have permission to scan arrears.", 403);
  }
}
