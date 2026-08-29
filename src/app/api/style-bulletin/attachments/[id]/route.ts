import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Stream the raw file bytes for viewing/downloading a single attachment.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const pool = await getPool("pitSystem");
    const result = await pool
      .request()
      .input("id", sql.Int, Number(id))
      .query(`SELECT FileName, ContentType, FileData FROM dbo.StyleBulletin_Attachment WHERE Id = @id`);

    const row = result.recordset[0];
    if (!row) {
      return Response.json({ error: "Attachment not found." }, { status: 404 });
    }

    return new Response(row.FileData, {
      headers: {
        "Content-Type": row.ContentType,
        "Content-Disposition": `inline; filename="${row.FileName}"`,
      },
    });
  } catch (err: unknown) {
    console.error("Attachment fetch error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
