import { getPool, sql } from "@/lib/db";

// Re-serves a previously generated PDF straight from storage — no
// regeneration, no QR re-rendering.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "id must be numeric." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        `SELECT WorkOrder, Pdf FROM dbo.QrCode_Pdf_Batch WHERE Id = @id`,
      );

    const row = result.recordset[0];
    if (!row) {
      return Response.json({ error: "Batch not found." }, { status: 404 });
    }

    return new Response(row.Pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="coupons-${row.WorkOrder}-${id}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error("PDF batch download error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
