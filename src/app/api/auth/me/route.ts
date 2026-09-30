import { getSession } from "@/lib/require-session";
import { getPermissionsForUser } from "@/features/auth/services/user-permissions.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ user: null, permissions: null });
  }
  // Admins have implicit full access and never get explicit rows, so their
  // permissions are always null rather than an (empty) fetched list.
  const permissions = session.isAdmin ? null : await getPermissionsForUser(session.userId);
  return Response.json({
    user: {
      id: session.userId,
      email: session.email,
      displayName: session.displayName,
      isAdmin: session.isAdmin,
      mustResetPassword: session.mustResetPassword,
    },
    permissions,
  });
}
