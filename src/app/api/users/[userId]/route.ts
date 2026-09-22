import { requireAdminSession, AuthError } from "@/lib/require-session";
import { deleteUser, updateUser } from "@/features/auth/services/users.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAdminSession();
    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    let body: { displayName?: string; isAdmin?: boolean; isActive?: boolean };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Prevent an admin from locking themselves out.
    if (userId === session.userId && (body.isAdmin === false || body.isActive === false)) {
      return Response.json({ error: "You cannot remove your own admin access or deactivate your own account." }, { status: 400 });
    }

    const updated = await updateUser(userId, body);
    if (!updated) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }
    return Response.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("update user failed", err);
    return Response.json({ error: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAdminSession();
    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    if (userId === session.userId) {
      return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const deleted = await deleteUser(userId);
    if (!deleted) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("delete user failed", err);
    return Response.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
