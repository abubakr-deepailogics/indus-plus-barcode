import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

async function ensureTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StyleBulletin_Attachment' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.StyleBulletin_Attachment (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        WorkOrder NVARCHAR(100) NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        ContentType NVARCHAR(100) NOT NULL,
        FileData VARBINARY(MAX) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy NVARCHAR(100) NULL
      );
      CREATE INDEX IX_StyleBulletin_Attachment_WorkOrder ON dbo.StyleBulletin_Attachment(WorkOrder);
    END
  `);
  return pool;
}

// List attachments (metadata only) for a work order.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("workOrder") || "").trim();

  if (!workOrder) {
    return Response.json({ error: "workOrder is required." }, { status: 400 });
  }

  try {
    const pool = await ensureTable();
    const result = await pool
      .request()
      .input("workOrder", sql.NVarChar, workOrder)
      .query(`
        SELECT Id, WorkOrder, FileName, ContentType, CreatedAt, CreatedBy
        FROM dbo.StyleBulletin_Attachment
        WHERE WorkOrder = @workOrder
        ORDER BY CreatedAt DESC
      `);

    return Response.json(result.recordset);
  } catch (err: unknown) {
    console.error("Attachment list error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Upload a new attachment (image or PDF) for a work order.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const workOrder = String(form.get("workOrder") || "").trim();
    const createdBy = String(form.get("createdBy") || "").trim();
    const file = form.get("file");

    if (!workOrder) {
      return Response.json({ error: "workOrder is required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "file is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: "Only image or PDF files are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pool = await ensureTable();

    const result = await pool
      .request()
      .input("workOrder", sql.NVarChar, workOrder)
      .input("fileName", sql.NVarChar, file.name)
      .input("contentType", sql.NVarChar, file.type)
      .input("fileData", sql.VarBinary(sql.MAX), buffer)
      .input("createdBy", sql.NVarChar, createdBy || null)
      .query(`
        INSERT INTO dbo.StyleBulletin_Attachment (WorkOrder, FileName, ContentType, FileData, CreatedBy)
        OUTPUT INSERTED.Id, INSERTED.WorkOrder, INSERTED.FileName, INSERTED.ContentType, INSERTED.CreatedAt, INSERTED.CreatedBy
        VALUES (@workOrder, @fileName, @contentType, @fileData, @createdBy)
      `);

    return Response.json(result.recordset[0]);
  } catch (err: unknown) {
    console.error("Attachment upload error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Delete an attachment by id.
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id) {
    return Response.json({ error: "id is required." }, { status: 400 });
  }

  try {
    const pool = await ensureTable();
    await pool
      .request()
      .input("id", sql.Int, Number(id))
      .query(`DELETE FROM dbo.StyleBulletin_Attachment WHERE Id = @id`);

    return Response.json({ ok: true });
  } catch (err: unknown) {
    console.error("Attachment delete error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
