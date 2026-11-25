import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { withRoute } from "@/lib/logger/with-route";
import { audit, setRequestUser } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withRoute("/api/auth/logout", async function POST() {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    setRequestUser({ userId: session.userId, email: session.email });
    audit("auth.logout");
  }
  store.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
});
