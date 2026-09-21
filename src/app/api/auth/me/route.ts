import { getSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ user: null });
  }
  return Response.json({
    user: {
      id: session.userId,
      email: session.email,
      displayName: session.displayName,
      isAdmin: session.isAdmin,
    },
  });
}
