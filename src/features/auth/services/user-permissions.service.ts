import { getPool, sql } from "@/lib/db";
import type { PageKey, PageOperation, PermissionDepartment, UserPermission } from "@/features/auth/types";

type PermissionRow = {
  Department: string;
  PageKey: string;
  Operation: string;
};

export async function getPermissionsForUser(userId: number): Promise<UserPermission[]> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query<PermissionRow>(
      "SELECT Department, PageKey, Operation FROM dbo.UserPermissions WHERE UserId = @userId",
    );
  return result.recordset.map((row) => ({
    department: row.Department as PermissionDepartment,
    pageKey: row.PageKey as PageKey,
    operation: row.Operation as PageOperation,
  }));
}

export async function replacePermissionsForUser(
  userId: number,
  permissions: UserPermission[],
): Promise<void> {
  const pool = await getPool("pitSystem");
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction
      .request()
      .input("userId", sql.Int, userId)
      .query("DELETE FROM dbo.UserPermissions WHERE UserId = @userId");

    for (const permission of permissions) {
      await transaction
        .request()
        .input("userId", sql.Int, userId)
        .input("department", sql.NVarChar, permission.department)
        .input("pageKey", sql.NVarChar, permission.pageKey)
        .input("operation", sql.NVarChar, permission.operation)
        .query(
          "INSERT INTO dbo.UserPermissions (UserId, Department, PageKey, Operation) VALUES (@userId, @department, @pageKey, @operation)",
        );
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
