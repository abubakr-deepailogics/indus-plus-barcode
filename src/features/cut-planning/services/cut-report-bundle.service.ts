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

// A work order's sewing coupons come from one source only (see
// hasApprovedBundles). The first approval switches it from indusPlus to Cut
// Report, so it is refused once indusPlus-sourced coupons exist: no approved
// bundle yet plus active sewing coupons means those coupons came from
// indusPlus. Locks are held until the caller's transaction ends so a coupon
// run cannot slip in between this check and the approval.
async function assertNoIndusPlusCoupons(
  transaction: sql.Transaction,
  workOrder: string,
): Promise<void> {
  const result = await new sql.Request(transaction)
    .input("workOrder", sql.NVarChar, workOrder)
    .query(`
      SELECT CASE WHEN
        NOT EXISTS (
          SELECT 1 FROM dbo.SewingCutReport WITH (UPDLOCK, HOLDLOCK)
          WHERE WorkOrder = @workOrder AND IsDeleted = 0 AND IsApproved = 1
        )
        AND EXISTS (
          SELECT 1 FROM dbo.QrCode_Coupon WITH (UPDLOCK, HOLDLOCK)
          WHERE WorkOrder = @workOrder AND Department = 'sewing' AND IsDeleted = 0
        )
      THEN 1 ELSE 0 END AS IsBlocked
    `);
  if (Number(result.recordset[0]?.IsBlocked) === 1) {
    throw new Error(
      `Sewing coupons for Work Order ${workOrder} were already generated from indus-plus data. Its Cut Report bundles cannot be approved; delete those coupons first to switch it to Cut Report.`,
    );
  }
}

// Approval is a conditional UPDATE: idempotent (already-approved rows are left
// untouched), and it never approves soft-deleted bundles. The transaction only
// covers the indusPlus-coupon guard above.
export async function approveGeneratedBundle(
  workOrderInput: string,
  reportRowId: number,
  approvedBy: string,
): Promise<{ bundleId: string; cutNo: string; alreadyApproved: boolean }> {
  const workOrder = workOrderInput.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!Number.isSafeInteger(reportRowId) || reportRowId <= 0) {
    throw new Error("A valid Cut Report row is required.");
  }

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await assertNoIndusPlusCoupons(transaction, workOrder);
    const result = await new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .input("reportRowId", sql.BigInt, reportRowId)
      .input("approvedBy", sql.NVarChar, approvedBy || "system")
      .query(`
        DECLARE @updated TABLE (BundleId NVARCHAR(32), CutNo NVARCHAR(100));

        UPDATE dbo.SewingCutReport
        SET IsApproved = 1, ApprovedAt = SYSUTCDATETIME(), ApprovedBy = @approvedBy
        OUTPUT INSERTED.BundleId, INSERTED.CutNo INTO @updated
        WHERE RowId = @reportRowId
          AND WorkOrder = @workOrder
          AND IsDeleted = 0
          AND IsApproved = 0;

        SELECT BundleId, CutNo, CAST(0 AS BIT) AS AlreadyApproved FROM @updated
        UNION ALL
        SELECT BundleId, CutNo, CAST(1 AS BIT)
        FROM dbo.SewingCutReport
        WHERE NOT EXISTS (SELECT 1 FROM @updated)
          AND RowId = @reportRowId
          AND WorkOrder = @workOrder
          AND IsDeleted = 0;
      `);
    const bundle = result.recordset[0] as
      | { BundleId: string; CutNo: string | null; AlreadyApproved: boolean }
      | undefined;
    if (!bundle) {
      throw new Error("This Cut Report bundle was not found or has been deleted.");
    }
    await transaction.commit();
    return {
      bundleId: String(bundle.BundleId),
      cutNo: String(bundle.CutNo ?? ""),
      alreadyApproved: Boolean(bundle.AlreadyApproved),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function approveGeneratedCut(
  workOrderInput: string,
  cutNoInput: string,
  approvedBy: string,
): Promise<{ cutNo: string; approvedCount: number; bundleCount: number }> {
  const workOrder = workOrderInput.trim();
  const cutNo = cutNoInput.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!cutNo) throw new Error("A Cut no. is required.");

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await assertNoIndusPlusCoupons(transaction, workOrder);
    // Same Cut matching as softDeleteGeneratedCut (trimmed, case-insensitive).
    const result = await new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .input("cutNo", sql.NVarChar, cutNo.toLocaleLowerCase())
      .input("approvedBy", sql.NVarChar, approvedBy || "system")
      .query(`
        UPDATE dbo.SewingCutReport
        SET IsApproved = 1, ApprovedAt = SYSUTCDATETIME(), ApprovedBy = @approvedBy
        WHERE WorkOrder = @workOrder
          AND LOWER(LTRIM(RTRIM(CutNo))) = @cutNo
          AND IsDeleted = 0
          AND IsApproved = 0;

        SELECT COUNT_BIG(*) AS BundleCount
        FROM dbo.SewingCutReport
        WHERE WorkOrder = @workOrder
          AND LOWER(LTRIM(RTRIM(CutNo))) = @cutNo
          AND IsDeleted = 0;
      `);
    const bundleCount = Number(result.recordset[0]?.BundleCount ?? 0);
    if (bundleCount === 0) {
      throw new Error(`No active generated bundles were found for Cut ${cutNo}.`);
    }
    await transaction.commit();
    return { cutNo, approvedCount: result.rowsAffected[0] ?? 0, bundleCount };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Coupon Generation's sewing data source switch: once any active bundle of the
// work order is approved in Cut Report, Cut Report is the source; until then
// the work order's bundles come from indusPlus.
export async function hasApprovedBundles(workOrder: string): Promise<boolean> {
  const trimmed = workOrder.trim();
  if (!trimmed) return false;

  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("workOrder", sql.NVarChar, trimmed)
    // Same pre-migration-056 fallback as findUnapprovedBundleIds below.
    .query(`
      DECLARE @approvalFilter NVARCHAR(100) =
        CASE WHEN COL_LENGTH('dbo.SewingCutReport', 'IsApproved') IS NULL
          THEN N'' ELSE N' AND report.IsApproved = 1' END;
      DECLARE @statement NVARCHAR(MAX) = N'
        SELECT CASE WHEN EXISTS (
          SELECT 1
          FROM dbo.SewingCutReport AS report
          INNER JOIN dbo.BundleGeneration AS generation
            ON generation.Id = report.BundleGenerationId
          WHERE report.WorkOrder = @workOrder
            AND report.IsDeleted = 0
            AND generation.IsDeleted = 0' + @approvalFilter + N'
        ) THEN 1 ELSE 0 END AS HasApproved';
      EXEC sp_executesql @statement,
        N'@workOrder NVARCHAR(4000)',
        @workOrder = @workOrder;
    `);
  return Number(result.recordset[0]?.HasApproved) === 1;
}

// Server-side guard for coupon generation: returns the requested sewing bundle
// ids that are missing, deleted or not yet approved for this work order.
export async function findUnapprovedBundleIds(
  workOrder: string,
  bundleIds: string[],
): Promise<string[]> {
  const requested = [...new Set(bundleIds.map((id) => id.trim()).filter(Boolean))];
  if (requested.length === 0) return [];

  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("workOrder", sql.NVarChar, workOrder.trim())
    .input("bundleIds", sql.NVarChar(sql.MAX), JSON.stringify(requested))
    // Until migration 056 adds IsApproved, every active bundle counts as
    // approved (pre-approval behaviour). Dynamic SQL keeps the batch compiling
    // on the old schema.
    .query(`
      DECLARE @approvalFilter NVARCHAR(100) =
        CASE WHEN COL_LENGTH('dbo.SewingCutReport', 'IsApproved') IS NULL
          THEN N'' ELSE N' AND report.IsApproved = 1' END;
      DECLARE @statement NVARCHAR(MAX) = N'
        SELECT report.BundleId
        FROM dbo.SewingCutReport AS report
        INNER JOIN OPENJSON(@bundleIds) WITH (BundleId NVARCHAR(32) ''$'') AS selected
          ON selected.BundleId = report.BundleId
        WHERE report.WorkOrder = @workOrder
          AND report.IsDeleted = 0' + @approvalFilter;
      EXEC sp_executesql @statement,
        N'@workOrder NVARCHAR(4000), @bundleIds NVARCHAR(MAX)',
        @workOrder = @workOrder, @bundleIds = @bundleIds;
    `);
  const approved = new Set(
    (result.recordset as Array<{ BundleId: string }>).map(({ BundleId }) => String(BundleId)),
  );
  return requested.filter((id) => !approved.has(id));
}
