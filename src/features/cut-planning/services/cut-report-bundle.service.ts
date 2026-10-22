import { getPool, sql } from "@/lib/db";

export async function softDeleteGeneratedBundle(
  workOrderInput: string,
  reportRowId: number,
  deletedBy: string,
): Promise<{ bundleId: string; cutNo: string }> {
  const workOrder = workOrderInput.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!Number.isSafeInteger(reportRowId) || reportRowId <= 0) {
    throw new Error("A valid Cut Report row is required.");
  }

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const bundleResult = await new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .input("reportRowId", sql.BigInt, reportRowId)
      .query(`
        SELECT report.BundleGenerationId, report.BundleId, report.CutNo
        FROM dbo.SewingCutReport AS report WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.BundleGeneration AS generation WITH (UPDLOCK, HOLDLOCK)
          ON generation.Id = report.BundleGenerationId
        WHERE report.RowId = @reportRowId
          AND report.WorkOrder = @workOrder
          AND report.IsDeleted = 0
          AND generation.IsDeleted = 0
      `);
    const bundle = bundleResult.recordset[0] as
      | { BundleGenerationId: number; BundleId: string; CutNo: string | null }
      | undefined;
    if (!bundle) {
      throw new Error("This Cut Report bundle was not found or has already been deleted.");
    }

    const couponResult = await new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .input("bundleId", sql.NVarChar, String(bundle.BundleId))
      .input("department", sql.NVarChar, "sewing")
      .query(`
        SELECT COUNT_BIG(*) AS CouponCount
        FROM dbo.QrCode_Coupon WITH (UPDLOCK, HOLDLOCK)
        WHERE WorkOrder = @workOrder
          AND BundleNo = @bundleId
          AND Department = @department
          AND IsDeleted = 0
      `);
    const couponCount = Number(couponResult.recordset[0]?.CouponCount ?? 0);
    if (couponCount > 0) {
      throw new Error(
        `Delete the ${couponCount} active coupon${couponCount === 1 ? "" : "s"} for bundle ${bundle.BundleId} before deleting this Cut Report row.`,
      );
    }

    const updateRequest = new sql.Request(transaction)
      .input("generationId", sql.BigInt, bundle.BundleGenerationId)
      .input("reportRowId", sql.BigInt, reportRowId)
      .input("deletedBy", sql.NVarChar, deletedBy || "system");
    const reportUpdate = await updateRequest.query(`
      UPDATE dbo.SewingCutReport
      SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @deletedBy
      WHERE RowId = @reportRowId AND BundleGenerationId = @generationId AND IsDeleted = 0;

      UPDATE dbo.BundleGenerationAllocation
      SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @deletedBy
      WHERE BundleGenerationId = @generationId AND IsDeleted = 0;

      UPDATE dbo.BundleGeneration
      SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @deletedBy
      WHERE Id = @generationId AND IsDeleted = 0;
    `);
    if ((reportUpdate.rowsAffected[0] ?? 0) !== 1) {
      throw new Error("This Cut Report bundle was not found or has already been deleted.");
    }

    await transaction.commit();
    return { bundleId: String(bundle.BundleId), cutNo: String(bundle.CutNo ?? "") };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function softDeleteGeneratedCut(
  workOrderInput: string,
  cutNoInput: string,
  deletedBy: string,
): Promise<{ cutNo: string; bundleCount: number }> {
  const workOrder = workOrderInput.trim();
  const cutNo = cutNoInput.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!cutNo) throw new Error("A Cut no. is required.");

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const bundlesResult = await new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .input("cutNo", sql.NVarChar, cutNo.toLocaleLowerCase())
      .query(`
        SELECT report.BundleGenerationId, report.BundleId, report.CutNo,
          COALESCE(coupons.CouponCount, 0) AS CouponCount
        FROM dbo.SewingCutReport AS report WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.BundleGeneration AS generation WITH (UPDLOCK, HOLDLOCK)
          ON generation.Id = report.BundleGenerationId
        OUTER APPLY (
          SELECT COUNT_BIG(*) AS CouponCount
          FROM dbo.QrCode_Coupon AS coupon WITH (UPDLOCK, HOLDLOCK)
          WHERE coupon.WorkOrder = report.WorkOrder
            AND coupon.BundleNo = report.BundleId
            AND coupon.Department = 'sewing'
            AND coupon.IsDeleted = 0
        ) AS coupons
        WHERE report.WorkOrder = @workOrder
          AND LOWER(LTRIM(RTRIM(report.CutNo))) = @cutNo
          AND report.IsDeleted = 0
          AND generation.IsDeleted = 0
      `);
    const bundles = bundlesResult.recordset as Array<{
      BundleGenerationId: number;
      BundleId: string;
      CutNo: string | null;
      CouponCount: number;
    }>;
    if (bundles.length === 0) {
      throw new Error(`No active generated bundles were found for Cut ${cutNo}.`);
    }
    const blockedBundles = bundles.filter((bundle) => Number(bundle.CouponCount) > 0);
    if (blockedBundles.length > 0) {
      throw new Error(
        "Coupons have been generated for these bundles. Delete the coupons first, then delete the bundles.",
      );
    }

    const generationIdsJson = JSON.stringify(
      bundles.map((bundle) => ({ id: bundle.BundleGenerationId })),
    );
    const updateResult = await new sql.Request(transaction)
      .input("generationIds", sql.NVarChar(sql.MAX), generationIdsJson)
      .input("deletedBy", sql.NVarChar, deletedBy || "system")
      .query(`
        UPDATE report
        SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @deletedBy
        FROM dbo.SewingCutReport AS report
        INNER JOIN OPENJSON(@generationIds) WITH (Id BIGINT '$.id') AS selected
          ON selected.Id = report.BundleGenerationId
        WHERE report.IsDeleted = 0;

        UPDATE allocation
        SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @deletedBy
        FROM dbo.BundleGenerationAllocation AS allocation
        INNER JOIN OPENJSON(@generationIds) WITH (Id BIGINT '$.id') AS selected
          ON selected.Id = allocation.BundleGenerationId
        WHERE allocation.IsDeleted = 0;

        UPDATE generation
        SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @deletedBy
        FROM dbo.BundleGeneration AS generation
        INNER JOIN OPENJSON(@generationIds) WITH (Id BIGINT '$.id') AS selected
          ON selected.Id = generation.Id
        WHERE generation.IsDeleted = 0;
      `);
    if ((updateResult.rowsAffected[0] ?? 0) !== bundles.length) {
      throw new Error("One or more bundles changed before deletion. Refresh Cut Report and try again.");
    }

    await transaction.commit();
    return { cutNo: String(bundles[0].CutNo ?? cutNo), bundleCount: bundles.length };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
