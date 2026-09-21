import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
