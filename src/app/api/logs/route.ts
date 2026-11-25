import { cookies } from "next/headers";
import { ingestClientLogs, MAX_INGEST_BODY_BYTES } from "@/lib/logger/client-ingest";
import { withRoute } from "@/lib/logger/with-route";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// Browser log ingest (see src/lib/logger/client.ts). Unauthenticated on
// purpose so errors on /login are captured; the session cookie, if present,
// is only used to attribute entries (signature check, no DB round-trip).
export const POST = withRoute(
  "/api/logs",
  async function POST(request: Request) {
    const declaredLength = Number(request.headers.get("content-length"));
    if (declaredLength > MAX_INGEST_BODY_BYTES) {
      return Response.json({ error: "Log batch too large." }, { status: 413 });
    }

    const session = verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    const result = ingestClientLogs(await request.text(), {
      clientKey: session ? `user:${session.userId}` : `ip:${ip}`,
      userAgent: request.headers.get("user-agent") ?? undefined,
      userId: session?.userId,
      userEmail: session?.email,
    });

    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return new Response(null, { status: 204 });
  },
  { level: "debug" },
);
