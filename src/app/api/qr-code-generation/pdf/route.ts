import { getPool, sql } from "@/lib/db";
import { generateCouponPdf } from "@/features/qr-code-generation/services/pdf-generation.service";
import type { BundleDetailRow, OperationsDetailRow } from "@/features/qr-code-generation/types";

interface GenerateRequestBody {
  anlNo: string;
  styleCode: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
}

// Generates the QR-coupon PDF once and stores it — repeat downloads read
// the stored bytes (GET /api/qr-code-generation/pdf/[id]) instead of
// re-rendering thousands of QR codes every time.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<GenerateRequestBody>;
  const { anlNo, styleCode, bundles, operations } = body;

  // styleCode is only a display label in the PDF header — some sources
  // (e.g. Open Order) have no real style code and legitimately send "".
  if (!anlNo || !Array.isArray(bundles) || !Array.isArray(operations)) {
    return Response.json(
      { error: "anlNo, bundles, and operations are all required." },
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
    const { buffer, cardCount } = await generateCouponPdf({
      anlNo,
      styleCode: styleCode ?? "",
      bundles: selectedBundles,
      operations,
    });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("anlNo", sql.NVarChar, anlNo)
      .input("styleCode", sql.NVarChar, styleCode ?? "")
      .input("cardCount", sql.Int, cardCount)
      .input("pdf", sql.VarBinary(sql.MAX), buffer)
      .query(
        `INSERT INTO dbo.QrCode_Pdf_Batch (AnlNo, StyleCode, CardCount, Pdf)
         OUTPUT INSERTED.Id, INSERTED.CreatedAt
         VALUES (@anlNo, @styleCode, @cardCount, @pdf)`,
      );

    const row = result.recordset[0];
    return Response.json({
      id: row.Id,
      cardCount,
      createdAt: row.CreatedAt,
    });
  } catch (err: unknown) {
    console.error("PDF batch generation error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Lists past batches for an order so the UI can offer re-download without
// regenerating.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anlNo = searchParams.get("anl_no") || "";
  if (!anlNo) {
    return Response.json({ error: "anl_no is required." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("anlNo", sql.NVarChar, anlNo)
      .query(
        `SELECT Id, AnlNo, StyleCode, CardCount, CreatedAt
         FROM dbo.QrCode_Pdf_Batch
         WHERE AnlNo = @anlNo
         ORDER BY CreatedAt DESC`,
      );
    return Response.json({ batches: result.recordset });
  } catch (err: unknown) {
    console.error("PDF batch list error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
