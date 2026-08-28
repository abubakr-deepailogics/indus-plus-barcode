import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";

  if (!workOrder) {
    return Response.json({ cutDetails: [], styleBulletins: [], metadata: null });
  }

  try {
    const pool = await getPool();

    // Fetch Cut Detail
    const cutDetailResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query(`
        SELECT * FROM dbo.Order_Po_Cut_Detail 
        WHERE Work_Order = @wo 
        ORDER BY TRY_CAST(Cut AS INT) ASC, TRY_CAST(Bundle_Id AS INT) ASC
      `);

    // Fetch Style Bulletin (Operations)
    const styleBulletinResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query(`
        SELECT sb.*, op.SkillLevel 
        FROM dbo.Order_StyleBulletin sb
        LEFT JOIN dbo.Operations op ON sb.Operation_Code = op.OperationCode
        WHERE sb.Order_No = @wo 
        ORDER BY sb.Operation_Sequence ASC
      `);

    // Fetch Style Bulletin Header (Metadata) if exists
    let metadata = null;
    try {
      const metadataResult = await pool
        .request()
        .input("wo", sql.NVarChar, workOrder)
        .query("SELECT * FROM dbo.Order_StyleBulletin_Header WHERE Work_Order = @wo");
      if (metadataResult.recordset.length > 0) {
        metadata = metadataResult.recordset[0];
      }
    } catch (metadataErr) {
      console.log("Order_StyleBulletin_Header table might not exist yet:", metadataErr);
    }

    return Response.json({
      cutDetails: cutDetailResult.recordset,
      styleBulletins: styleBulletinResult.recordset,
      metadata,
    });
  } catch (err: unknown) {
    console.error("Database API error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      workOrder,
      description,
      styleDescription,
      styleCategory,
      smdNo,
      finalSmdNo,
      target,
      targetUnitMin,
      startTime,
      pocSam,
      pocPieceRate,
      headReqd,
      appDate,
      appBy,
      status,
      forwardForApproval,
    } = body;

    if (!workOrder) {
      return Response.json({ error: "Work Order (workOrder) is required." }, { status: 400 });
    }

    const pool = await getPool();

    // 1. Create table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Order_StyleBulletin_Header]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Order_StyleBulletin_Header] (
              [Work_Order] NVARCHAR(50) NOT NULL PRIMARY KEY,
              [Description] NVARCHAR(255) NULL,
              [Style_Description] NVARCHAR(255) NULL,
              [Style_Category] NVARCHAR(100) NULL,
              [Smd_No] NVARCHAR(50) NULL,
              [Final_Smd_No] NVARCHAR(50) NULL,
              [Target] NVARCHAR(50) NULL,
              [Target_Unit_Min] NVARCHAR(50) NULL,
              [Start_Time] NVARCHAR(50) NULL,
              [Poc_Sam] NVARCHAR(50) NULL,
              [Poc_Piece_Rate] NVARCHAR(50) NULL,
              [Head_Reqd] NVARCHAR(50) NULL,
              [App_Date] NVARCHAR(50) NULL,
              [App_By] NVARCHAR(100) NULL,
              [Status] NVARCHAR(50) NULL,
              [Forward_For_Approval] NVARCHAR(50) NULL,
              [UpdatedAt] DATETIME DEFAULT GETDATE()
          )
      END
      ELSE
      BEGIN
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order_StyleBulletin_Header]') AND name = 'Forward_For_Approval')
          BEGIN
              ALTER TABLE [dbo].[Order_StyleBulletin_Header] ADD [Forward_For_Approval] NVARCHAR(50) NULL
          END
      END
    `);

    // 2. Perform UPSERT using MERGE
    await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .input("desc", sql.NVarChar, description || "")
      .input("styleDesc", sql.NVarChar, styleDescription || "")
      .input("styleCat", sql.NVarChar, styleCategory || "")
      .input("smdNo", sql.NVarChar, smdNo || "")
      .input("finalSmdNo", sql.NVarChar, finalSmdNo || "")
      .input("target", sql.NVarChar, target || "")
      .input("targetUnitMin", sql.NVarChar, targetUnitMin || "")
      .input("startTime", sql.NVarChar, startTime || "")
      .input("pocSam", sql.NVarChar, pocSam || "")
      .input("pocPieceRate", sql.NVarChar, pocPieceRate || "")
      .input("headReqd", sql.NVarChar, headReqd || "")
      .input("appDate", sql.NVarChar, appDate || "")
      .input("appBy", sql.NVarChar, appBy || "")
      .input("status", sql.NVarChar, status || "Approved")
      .input("forwardForApproval", sql.NVarChar, forwardForApproval || "No")
      .query(`
        MERGE INTO dbo.Order_StyleBulletin_Header AS target
        USING (SELECT @wo AS Work_Order) AS source
        ON (target.Work_Order = source.Work_Order)
        WHEN MATCHED THEN
            UPDATE SET 
                Description = @desc,
                Style_Description = @styleDesc,
                Style_Category = @styleCat,
                Smd_No = @smdNo,
                Final_Smd_No = @finalSmdNo,
                Target = @target,
                Target_Unit_Min = @targetUnitMin,
                Start_Time = @startTime,
                Poc_Sam = @pocSam,
                Poc_Piece_Rate = @pocPieceRate,
                Head_Reqd = @headReqd,
                App_Date = @appDate,
                App_By = @appBy,
                Status = @status,
                Forward_For_Approval = @forwardForApproval,
                UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (Work_Order, Description, Style_Description, Style_Category, Smd_No, Final_Smd_No, Target, Target_Unit_Min, Start_Time, Poc_Sam, Poc_Piece_Rate, Head_Reqd, App_Date, App_By, Status, Forward_For_Approval)
            VALUES (source.Work_Order, @desc, @styleDesc, @styleCat, @smdNo, @finalSmdNo, @target, @targetUnitMin, @startTime, @pocSam, @pocPieceRate, @headReqd, @appDate, @appBy, @status, @forwardForApproval);
      `);

    return Response.json({ success: true, message: "Bulletin details saved successfully." });
  } catch (err: unknown) {
    console.error("Database Save API error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
