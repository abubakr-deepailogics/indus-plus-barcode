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
//
// Streams newline-delimited JSON progress lines over the response body
// instead of one final Response.json — a large work order's registration
// runs several chunked round trips (see registerCoupons), and this lets the
// UI show live progress without switching off POST (the request body is a
// JSON payload, not query params, so GET/EventSource isn't an option).
// Validation still happens up front and still returns a plain JSON error
// response — the stream only starts once there's actually work to stream.
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

  const cards = buildCouponCards(selectedBundles, selectedOperations);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      };
      try {
        const pool = await getPool();
        await registerCoupons(pool, workOrder, cards, (done, total) => {
          send({ done, total });
        });
        const couponCount = await countCoupons(pool, workOrder);
        send({ done: cards.length, total: cards.length, status: "complete", cardCount: cards.length, couponCount });
      } catch (err: unknown) {
        // Headers are already committed once the stream starts, so an
        // error here can't fall back to a JSON error response/status code
        // the way the old non-streaming handler did — it goes in-band as a
        // final line instead.
        console.error("Coupon registration error:", err);
        const message = err instanceof Error ? err.message : "Internal Server Error";
        send({ status: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
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
