import { cookies } from "next/headers";
import { requireSession, AuthError } from "@/lib/require-session";
import { setUserPassword, verifyCurrentPassword } from "@/features/auth/services/users.service";
import { isPasswordStrongEnough } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    let body: { currentPassword?: string; newPassword?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Current and new password are required." }, { status: 400 });
    }
    if (!isPasswordStrongEnough(newPassword)) {
      return Response.json(
        { error: "New password must be at least 8 characters and include upper, lower case letters and a number." },
        { status: 400 },
      );
    }

    const valid = await verifyCurrentPassword(session.userId, currentPassword);
    if (!valid) {
      return Response.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    await setUserPassword(session.userId, newPassword, false);

    const token = createSessionToken({
      userId: session.userId,
      email: session.email,
      displayName: session.displayName,
      isAdmin: session.isAdmin,
      mustResetPassword: false,
    });
    const store = await cookies();
    await setSessionCookie(store, token, request.url);

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("change-password failed", err);
    return Response.json({ error: "Failed to change password." }, { status: 500 });
  }
}
