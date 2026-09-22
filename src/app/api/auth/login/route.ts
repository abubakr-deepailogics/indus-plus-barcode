import { cookies } from "next/headers";
import { verifyCredentials } from "@/features/auth/services/users.service";
import { createSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }

  const result = await verifyCredentials(email, password);
  if (!result) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = createSessionToken({
    userId: result.user.id,
    email: result.user.email,
    displayName: result.user.displayName,
    isAdmin: result.user.isAdmin,
    mustResetPassword: result.mustResetPassword,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return Response.json({ user: result.user, mustResetPassword: result.mustResetPassword });
}
