import { fetchCorReportData } from "@/features/cut-planning/services/cor-report-data.service";
import { generateBundlingTicketsPdf } from "@/features/cut-planning/services/cor-report-pdf.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    const buffer = await generateBundlingTicketsPdf(data.meta, data.rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="bundling-tickets-${workOrder}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Bundling tickets generation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate bundling tickets." },
      { status: 500 },
    );
  }
}
