import { getPool, sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { AuthUser, CreateUserInput, ManagedUser, UpdateUserInput } from "@/features/auth/types";

type UserRow = {
  UserId: number;
  Email: string;
  DisplayName: string;
  PasswordHash: string;
  IsAdmin: boolean;
  IsActive: boolean;
  MustResetPassword: boolean;
  CreatedAt: Date;
  LastLoginAt: Date | null;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.UserId,
    email: row.Email,
    displayName: row.DisplayName,
    isAdmin: row.IsAdmin,
    mustResetPassword: row.MustResetPassword,
  };
}

function toManagedUser(row: UserRow): ManagedUser {
  return {
    id: row.UserId,
    email: row.Email,
    displayName: row.DisplayName,
    isAdmin: row.IsAdmin,
    isActive: row.IsActive,
    mustResetPassword: row.MustResetPassword,
    createdAt: row.CreatedAt.toISOString(),
    lastLoginAt: row.LastLoginAt ? row.LastLoginAt.toISOString() : null,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("email", sql.NVarChar, email.trim().toLowerCase())
    .query<UserRow>(
      "SELECT UserId, Email, DisplayName, PasswordHash, IsAdmin, IsActive, MustResetPassword, CreatedAt, LastLoginAt FROM dbo.Users WHERE Email = @email",
    );
  return result.recordset[0] ?? null;
}

export async function findUserById(userId: number): Promise<UserRow | null> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query<UserRow>(
      "SELECT UserId, Email, DisplayName, PasswordHash, IsAdmin, IsActive, MustResetPassword, CreatedAt, LastLoginAt FROM dbo.Users WHERE UserId = @userId",
    );
  return result.recordset[0] ?? null;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ user: AuthUser; mustResetPassword: boolean } | null> {
  const row = await findUserByEmail(email);
  if (!row || !row.IsActive) return null;
  const valid = await verifyPassword(password, row.PasswordHash);
  if (!valid) return null;

  const pool = await getPool("pitSystem");
  await pool
    .request()
    .input("userId", sql.Int, row.UserId)
    .query("UPDATE dbo.Users SET LastLoginAt = GETDATE() WHERE UserId = @userId");

  return { user: toAuthUser(row), mustResetPassword: row.MustResetPassword };
}

export async function listUsers(): Promise<ManagedUser[]> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .query<UserRow>(
      "SELECT UserId, Email, DisplayName, PasswordHash, IsAdmin, IsActive, MustResetPassword, CreatedAt, LastLoginAt FROM dbo.Users ORDER BY CreatedAt DESC",
    );
  return result.recordset.map(toManagedUser);
}

export async function createUser(
  input: CreateUserInput,
  createdBy: string,
): Promise<ManagedUser> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const pool = await getPool("pitSystem");

  try {
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("displayName", sql.NVarChar, input.displayName.trim())
      .input("passwordHash", sql.NVarChar, passwordHash)
      .input("isAdmin", sql.Bit, input.isAdmin)
      .input("createdBy", sql.NVarChar, createdBy)
      .query<UserRow>(`
        INSERT INTO dbo.Users (Email, DisplayName, PasswordHash, IsAdmin, IsActive, MustResetPassword, CreatedBy)
        OUTPUT INSERTED.*
        VALUES (@email, @displayName, @passwordHash, @isAdmin, 1, 1, @createdBy)
      `);
    return toManagedUser(result.recordset[0]);
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      throw new Error("A user with this email already exists.");
    }
    throw err;
  }
}

export async function updateUser(
  userId: number,
  input: UpdateUserInput,
): Promise<ManagedUser | null> {
  const pool = await getPool("pitSystem");
  const sets: string[] = [];
  const request = pool.request().input("userId", sql.Int, userId);

  if (input.displayName !== undefined) {
    sets.push("DisplayName = @displayName");
    request.input("displayName", sql.NVarChar, input.displayName.trim());
  }
  if (input.isAdmin !== undefined) {
    sets.push("IsAdmin = @isAdmin");
    request.input("isAdmin", sql.Bit, input.isAdmin);
  }
  if (input.isActive !== undefined) {
    sets.push("IsActive = @isActive");
    request.input("isActive", sql.Bit, input.isActive);
  }
  if (sets.length === 0) {
    const pool2 = await getPool("pitSystem");
    const existing = await pool2
      .request()
      .input("userId", sql.Int, userId)
      .query<UserRow>("SELECT * FROM dbo.Users WHERE UserId = @userId");
    return existing.recordset[0] ? toManagedUser(existing.recordset[0]) : null;
  }

  sets.push("UpdatedAt = GETDATE()");
  const result = await request.query<UserRow>(`
    UPDATE dbo.Users SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE UserId = @userId
  `);
  return result.recordset[0] ? toManagedUser(result.recordset[0]) : null;
}

export async function setUserPassword(
  userId: number,
  newPassword: string,
  forceResetOnNextLogin: boolean,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  const pool = await getPool("pitSystem");
  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("passwordHash", sql.NVarChar, passwordHash)
    .input("mustReset", sql.Bit, forceResetOnNextLogin)
    .query(
      "UPDATE dbo.Users SET PasswordHash = @passwordHash, MustResetPassword = @mustReset, UpdatedAt = GETDATE() WHERE UserId = @userId",
    );
}

export async function deleteUser(userId: number): Promise<boolean> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query("DELETE FROM dbo.Users WHERE UserId = @userId");
  return result.rowsAffected[0] > 0;
}

export async function verifyCurrentPassword(userId: number, password: string): Promise<boolean> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query<UserRow>("SELECT PasswordHash FROM dbo.Users WHERE UserId = @userId");
  const row = result.recordset[0];
  if (!row) return false;
  return verifyPassword(password, row.PasswordHash);
}
