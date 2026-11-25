import { cookies } from "next/headers";
import { verifyCredentials } from "@/features/auth/services/users.service";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { withRoute } from "@/lib/logger/with-route";
import { audit, setRequestUser } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withRoute("/api/auth/login", async function POST(request: Request) {
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
    audit("auth.login_failed", { email });
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
  await setSessionCookie(store, token, request.url);
  setRequestUser({ userId: result.user.id, email: result.user.email });
  audit("auth.login", { isAdmin: result.user.isAdmin, mustResetPassword: result.mustResetPassword });

  return Response.json({ user: result.user, mustResetPassword: result.mustResetPassword });
});
