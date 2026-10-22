import {
  getPool,
  sql,
  cutDetailByFilter,
  styleBulletinByFilter,
} from "@/lib/db";
import { isStyleBulletinDepartment } from "@/lib/department-classification";
import { getCutPlanning } from "@/features/cut-planning/services/cut-planning.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("work_order") || "").trim();
  const department = (searchParams.get("department") || "")
    .trim()
    .toLowerCase();

  if (department && !isStyleBulletinDepartment(department)) {
    return Response.json(
      { error: "department must be one of: cutting, sewing, washing, finishing." },
      { status: 400 },
    );
  }

  if (!workOrder) {
    return Response.json({
      cutDetails: [],
      styleBulletins: [],
      metadata: null,
    });
  }

  try {
    const pool = await getPool("indusPlus");
    const styleBulletinRequest = pool
      .request()
      .input("wo", sql.NVarChar, workOrder);

    if (department) {
      styleBulletinRequest.input(
        "department",
        sql.NVarChar,
        `${department.charAt(0).toUpperCase()}${department.slice(1)}`,
      );
    }

    const [styleBulletinResult, cutDetailResult] = await Promise.all([
      styleBulletinRequest.query(
        styleBulletinByFilter(
          department
            ? "[Order No] = @wo AND op.Department = @department"
            : "[Order No] = @wo",
        ),
      ),
      pool
        .request()
        .input("wo", sql.NVarChar, workOrder)
        .query(cutDetailByFilter("[Work Order #] = @wo"))
        .catch((err) => {
          console.error("Cut Detail lookup failed:", err);
          return { recordset: [] };
        }),
    ]);

    // Sewing bundles are generated from Cut Planning in PIT. SewingCutReport
    // is the immutable generation-time record: do not reconstruct this
    // response from today's mutable planning rows, especially after a shade
    // split changes visible Cut 5 into 5A/5B.
    let generatedBundles: Array<Record<string, unknown>> = [];
    try {
      const pitPool = await getPool("pitSystem");
      // Migration 053 adds these columns. Keep the Cut Report readable while
      // that migration is being rolled out, rather than treating an old schema
      // as if the work order had no generated bundles.
      const softDeleteColumns = await pitPool.request().query(`
        SELECT
          CASE WHEN COL_LENGTH('dbo.SewingCutReport', 'IsDeleted') IS NULL THEN 0 ELSE 1 END AS HasReportSoftDelete,
          CASE WHEN COL_LENGTH('dbo.BundleGeneration', 'IsDeleted') IS NULL THEN 0 ELSE 1 END AS HasGenerationSoftDelete
      `);
      const schema = softDeleteColumns.recordset[0] as {
        HasReportSoftDelete?: number;
        HasGenerationSoftDelete?: number;
      } | undefined;
      const activeBundlePredicates = [
        Number(schema?.HasReportSoftDelete) === 1 ? "report.IsDeleted = 0" : "",
        Number(schema?.HasGenerationSoftDelete) === 1 ? "generation.IsDeleted = 0" : "",
      ].filter(Boolean);
      const activeBundleWhere = activeBundlePredicates.length
        ? `\n          AND ${activeBundlePredicates.join("\n          AND ")}`
        : "";
      const generatedResult = await pitPool.request().input("wo", sql.NVarChar, workOrder).query(`
        SELECT
          report.RowId,
          ROW_NUMBER() OVER (ORDER BY generation.BundleSequence) AS DisplayRowId,
          report.WorkOrder AS Work_Order,
          report.CutNo AS Cut,
          report.BundleId AS Bundle_Id,
          report.BundleQty AS Bundle_Qty,
          report.Inseam,
          report.Size,
          report.Color,
          report.Shade,
          report.Shrinkage,
          COALESCE(coupons.ActiveCouponCount, 0) AS ActiveCouponCount,
          NULL AS MarkerWidthCm,
          NULL AS MarkerLengthM,
          generation.BundleSequence
        FROM dbo.SewingCutReport AS report
        INNER JOIN dbo.BundleGeneration AS generation
          ON generation.Id = report.BundleGenerationId
        LEFT JOIN (
          SELECT BundleNo, COUNT_BIG(*) AS ActiveCouponCount
          FROM dbo.QrCode_Coupon
          WHERE WorkOrder = @wo
            AND Department = 'sewing'
            AND IsDeleted = 0
          GROUP BY BundleNo
        ) AS coupons
          ON coupons.BundleNo = report.BundleId
        WHERE report.WorkOrder = @wo
          ${activeBundleWhere}
        ORDER BY generation.BundleSequence
      `);
      generatedBundles = generatedResult.recordset;
      if (generatedBundles.length > 0) {
        const planning = await getCutPlanning(workOrder);
        generatedBundles = generatedBundles.map((bundle) => {
          return {
            ...bundle,
            Customer_Name: planning.metadata?.customerName ?? "",
            Fabric_Code_Main_Body:
              planning.metadata?.accessItems.map((item) => item.itemName).join(", ") ?? "",
          };
        });
      }
    } catch (bundleError) {
      console.error("Generated sewing bundle lookup failed:", bundleError);
    }

    // Fetch Style Bulletin Header (Metadata) — this app's own write data,
    // lives on pitSystem (see db/migrations/010_order_style_bulletin_header.sql),
    // not the read-only indusPlus/ERP connection.
    let metadata = null;
    try {
      const pitPool = await getPool("pitSystem");
      const metadataResult = await pitPool
        .request()
        .input("wo", sql.NVarChar, workOrder)
        .input("department", sql.NVarChar, department || "sewing")
        .query(
          "SELECT * FROM dbo.Order_StyleBulletin_Header WHERE Work_Order = @wo AND Department = @department",
        );
      if (metadataResult.recordset.length > 0) {
        metadata = metadataResult.recordset[0];
      }
    } catch (metadataErr) {
      console.log(
        "Order_StyleBulletin_Header table might not exist yet:",
        metadataErr,
      );
    }

    return Response.json({
      cutDetails:
        department === "sewing" ? generatedBundles : cutDetailResult.recordset,
      styleBulletins: styleBulletinResult.recordset,
      metadata,
    });
  } catch (err: unknown) {
    console.error("Database API error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
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
      department: rawDepartment,
    } = body;
    const department = String(rawDepartment || "sewing").trim().toLowerCase();

    if (!workOrder) {
      return Response.json(
        { error: "Work Order (workOrder) is required." },
        { status: 400 },
      );
    }
    if (!isStyleBulletinDepartment(department)) {
      return Response.json({ error: "Invalid department." }, { status: 400 });
    }

    // App-owned write data — lives on pitSystem (see
    // db/migrations/010_order_style_bulletin_header.sql), not the read-only
    // indusPlus/ERP connection, which has no CREATE TABLE permission anyway.
    const pool = await getPool("pitSystem");

    // Perform UPSERT using MERGE
    await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .input("department", sql.NVarChar, department)
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
        USING (SELECT @wo AS Work_Order, @department AS Department) AS source
        ON (target.Work_Order = source.Work_Order AND target.Department = source.Department)
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
            INSERT (Work_Order, Department, Description, Style_Description, Style_Category, Smd_No, Final_Smd_No, Target, Target_Unit_Min, Start_Time, Poc_Sam, Poc_Piece_Rate, Head_Reqd, App_Date, App_By, Status, Forward_For_Approval)
            VALUES (source.Work_Order, source.Department, @desc, @styleDesc, @styleCat, @smdNo, @finalSmdNo, @target, @targetUnitMin, @startTime, @pocSam, @pocPieceRate, @headReqd, @appDate, @appBy, @status, @forwardForApproval);
      `);

    return Response.json({
      success: true,
      message: "Bulletin details saved successfully.",
    });
  } catch (err: unknown) {
    console.error("Database Save API error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
