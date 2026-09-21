import { requireAdminSession, AuthError } from "@/lib/require-session";
import { setUserPassword } from "@/features/auth/services/users.service";
import { generateStrongPassword, isPasswordStrongEnough } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdminSession();
    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    let body: { password?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const password = body.password || generateStrongPassword();
    if (!isPasswordStrongEnough(password)) {
      return Response.json(
        { error: "Password must be at least 8 characters and include upper, lower case letters and a number." },
        { status: 400 },
      );
    }

    await setUserPassword(userId, password, true);
    return Response.json({ temporaryPassword: password });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("reset password failed", err);
    return Response.json({ error: "Failed to reset password." }, { status: 500 });
  }
}
