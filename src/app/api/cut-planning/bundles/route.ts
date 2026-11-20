import {
  generateBundles,
  getActiveBundleSequences,
} from "@/features/cut-planning/services/cut-planning.service";
import type { GenerateBundlesPayload } from "@/features/cut-planning/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workOrder = new URL(request.url).searchParams.get("work_order")?.trim();
  if (!workOrder) return Response.json({ usedSequences: [] });
  try {
    return Response.json({
      usedSequences: await getActiveBundleSequences(workOrder),
    });
  } catch (error) {
    console.error("Bundle preview GET error:", error);
    return Response.json(
      { error: "Unable to prepare the bundle preview." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerateBundlesPayload;
    const result = await generateBundles(payload, "system");
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("Bundle generation POST error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate bundles." },
      { status: 400 },
    );
  }
}
