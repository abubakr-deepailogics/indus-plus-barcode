import { fetchCorReportData } from "@/features/cut-planning/services/cor-report-data.service";
import { generateCorSheetPdf } from "@/features/cut-planning/services/cor-report-pdf.service";
import { withRoute } from "@/lib/logger/with-route";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withRoute("/api/cut-planning/reports/cor-sheet", async function GET(request: Request) {
  const workOrder = new URL(request.url).searchParams.get("work_order")?.trim();
  if (!workOrder) {
    return Response.json({ error: "work_order is required." }, { status: 400 });
  }
  try {
    const data = await fetchCorReportData(workOrder);
    if (!data) {
      return Response.json(
        { error: "No generated Cut Report bundles were found for this work order." },
        { status: 404 },
      );
    }
    const buffer = await generateCorSheetPdf(data.meta, data.rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cor-sheet-${workOrder}.pdf"`,
      },
    });
  } catch (error) {
    logger.error("COR sheet generation error", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate the COR sheet." },
      { status: 500 },
    );
  }
});
