import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "@/lib/session";
import { findUserById } from "@/features/auth/services/users.service";
import { setRequestUser } from "@/lib/logger/context";
import { AuthError } from "@/lib/http-error";

export { AuthError };

// The session cookie is a signed, stateless token, so a valid signature only
// proves it hasn't been tampered with — not that the account it names still
// exists or is still active. A deleted/disabled user's already-issued cookie
// stays cryptographically valid until it expires (up to 12h), so every call
// re-checks the account against the DB rather than trusting the cookie alone.
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user || !user.IsActive) {
    store.delete(SESSION_COOKIE_NAME);
    return null;
  }
  // Attribute every subsequent log line / audit record of this request.
  setRequestUser({ userId: session.userId, email: session.email });
  return session;
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Not authenticated", 401);
  }
  return session;
}

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!session.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return session;
}
