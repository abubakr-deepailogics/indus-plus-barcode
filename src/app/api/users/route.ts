import { requireAdminSession, AuthError } from "@/lib/require-session";
import { createUser, listUsers } from "@/features/auth/services/users.service";
import { isPasswordStrongEnough } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminSession();
    const users = await listUsers();
    return Response.json(users);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("list users failed", err);
    return Response.json({ error: "Failed to load users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();

    let body: { email?: string; displayName?: string; password?: string; isAdmin?: boolean };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { email, displayName, password, isAdmin } = body;
    if (!email || !displayName || !password) {
      return Response.json({ error: "Email, display name, and password are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (!isPasswordStrongEnough(password)) {
      return Response.json(
        { error: "Password must be at least 8 characters and include upper, lower case letters and a number." },
        { status: 400 },
      );
    }

    const user = await createUser(
      { email, displayName, password, isAdmin: !!isAdmin },
      session.email,
    );
    return Response.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error && /already exists/i.test(err.message)) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    console.error("create user failed", err);
    return Response.json({ error: "Failed to create user." }, { status: 500 });
  }
}
