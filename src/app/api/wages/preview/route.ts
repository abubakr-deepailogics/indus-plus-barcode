import {
  buildWageData,
  validateTenure,
} from "@/features/wages/services/wage-builder.service";
import { findOverlappingWage } from "@/features/wages/services/wage-lock.service";

export const dynamic = "force-dynamic";

// ── GET /api/wages/preview?from=yyyy-MM-dd&to=yyyy-MM-dd ─────────────────────
// What the create-wages modal shows before locking a tenure: how many orders
// and coupons it covers, and what it totals. Runs the same builder POST does,
// so the confirmed numbers are the written ones.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const tenure = validateTenure(searchParams.get("from"), searchParams.get("to"));
  if (!tenure.ok) {
    return Response.json({ error: tenure.error }, { status: 400 });
  }

  try {
    // Surfaced as part of the preview so the modal can warn before the user
    // commits, rather than failing them at the confirm step.
    const overlap = await findOverlappingWage(tenure.from, tenure.to);

    const built = await buildWageData(tenure.from, tenure.to);
    if (!built.ok) {
      return Response.json({ error: built.error }, { status: built.status });
    }

    return Response.json({
      from: tenure.from,
      to: tenure.to,
      ...built.preview,
      overlap: overlap
        ? { wageId: overlap.wageId, title: overlap.title, from: overlap.from, to: overlap.to }
        : null,
    });
  } catch (err: unknown) {
    console.error("GET /api/wages/preview error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
