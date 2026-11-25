import {
  generateBundles,
  getActiveBundleSequences,
} from "@/features/cut-planning/services/cut-planning.service";
import type { GenerateBundlesPayload } from "@/features/cut-planning/types";
import { withRoute } from "@/lib/logger/with-route";
import { audit, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withRoute("/api/cut-planning/bundles", async function GET(request: Request) {
  const workOrder = new URL(request.url).searchParams.get("work_order")?.trim();
  if (!workOrder) return Response.json({ usedSequences: [] });
  try {
    return Response.json({
      usedSequences: await getActiveBundleSequences(workOrder),
    });
  } catch (error) {
    logger.error("Bundle preview GET error", error);
    return Response.json(
      { error: "Unable to prepare the bundle preview." },
      { status: 500 },
    );
  }
});

export const POST = withRoute("/api/cut-planning/bundles", async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerateBundlesPayload;
    const result = await generateBundles(payload, "system");
    audit("cut_planning.generate_bundles", { workOrder: payload?.workOrder, cutNos: payload?.cutNos, bundleQty: payload?.bundleQty, mergeCuts: payload?.mergeCuts });
    return Response.json({ success: true, ...result });
  } catch (error) {
    logger.error("Bundle generation POST error", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate bundles." },
      { status: 400 },
    );
  }
});
