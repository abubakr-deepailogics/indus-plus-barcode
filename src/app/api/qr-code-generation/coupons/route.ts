import { getPool } from "@/lib/db";
import { buildCouponCards } from "@/features/qr-code-generation/services/coupon-pairing.service";
import { registerCoupons, countCoupons, listCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";
import type { BundleDetailRow, OperationsDetailRow } from "@/features/qr-code-generation/types";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

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
  const selectedOperations = operations.filter((op) => op.lastOpSection);
  if (selectedBundles.length === 0 || selectedOperations.length === 0) {
    return Response.json(
      { error: "No bundles or operations selected to generate." },
      { status: 400 },
    );
  }

  try {
    const pool = await getPool();
    const cards = buildCouponCards(selectedBundles, selectedOperations);

    await registerCoupons(pool, workOrder, cards);
    const couponCount = await countCoupons(pool, workOrder);

    return Response.json({ cardCount: cards.length, couponCount });
  } catch (err: unknown) {
    console.error("Coupon registration error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Paginated list of a work order's registered coupons — a work order can
// have thousands, so this is always page-scoped, never a full dump.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("page_size")) || DEFAULT_PAGE_SIZE),
  );
  const bundleNo = searchParams.get("bundle_no") || undefined;
  const opNo = searchParams.get("op_no") || undefined;
  const section = searchParams.get("section") || undefined;
  const scannedParam = searchParams.get("is_scanned");
  const isScanned = scannedParam === null ? undefined : scannedParam === "true";
  const fromCut = searchParams.get("from_cut") || undefined;
  const toCut = searchParams.get("to_cut") || undefined;

  if (!workOrder) {
    return Response.json({ error: "work_order is required." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const { rows, total } = await listCoupons(pool, workOrder, page, pageSize, {
      bundleNo,
      opNo,
      section,
      isScanned,
      fromCut,
      toCut,
    });
    return Response.json({ coupons: rows, total, page, pageSize });
  } catch (err: unknown) {
    console.error("Coupon list error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
