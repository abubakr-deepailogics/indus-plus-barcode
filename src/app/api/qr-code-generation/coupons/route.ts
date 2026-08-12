import { getPool } from "@/lib/db";
import { buildCouponCards } from "@/features/qr-code-generation/services/coupon-pairing.service";
import { registerCoupons, countCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";
import type { BundleDetailRow, OperationsDetailRow } from "@/features/qr-code-generation/types";

interface GenerateCouponsRequestBody {
  workOrder: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
}

// Registers coupon identities in the DB only — no PDF render, no PDF
// storage. Printing is a separate step (POST /api/qr-code-generation/pdf)
// that renders whatever is already registered.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<GenerateCouponsRequestBody>;
  const { workOrder, bundles, operations } = body;

  if (!workOrder || !Array.isArray(bundles) || !Array.isArray(operations)) {
    return Response.json(
      { error: "workOrder, bundles, and operations are all required." },
      { status: 400 },
    );
  }

  const selectedBundles = bundles.filter((b) => b.sel);
  if (selectedBundles.length === 0 || operations.length === 0) {
    return Response.json(
      { error: "No bundles selected or no operations to generate." },
      { status: 400 },
    );
  }

  try {
    const pool = await getPool();
    const cards = buildCouponCards(selectedBundles, operations);

    await registerCoupons(pool, workOrder, cards);
    const couponCount = await countCoupons(pool, workOrder);

    return Response.json({ cardCount: cards.length, couponCount });
  } catch (err: unknown) {
    console.error("Coupon registration error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
