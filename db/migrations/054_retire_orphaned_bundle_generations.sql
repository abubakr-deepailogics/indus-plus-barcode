-- BundleGeneration and its allocations existed before SewingCutReport was
-- introduced. Those older rows have no report row, so they cannot be shown or
-- deleted through Cut Report, yet they still lock the source Cut Planning row.
--
-- Retire only orphaned, coupon-free bundles. A bundle with an active sewing
-- coupon remains active: its source plan must stay locked until that coupon is
-- resolved through the normal workflow.
;WITH RetiredBundles AS (
  SELECT generation.Id
  FROM dbo.BundleGeneration AS generation
  WHERE generation.IsDeleted = 0
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.SewingCutReport AS report
      WHERE report.BundleGenerationId = generation.Id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.QrCode_Coupon AS coupon
      WHERE coupon.WorkOrder = generation.WorkOrder
        AND coupon.BundleNo = generation.BundleId
        AND coupon.Department = 'sewing'
        AND coupon.IsDeleted = 0
    )
)
UPDATE allocation
SET IsDeleted = 1,
    DeletedAt = SYSUTCDATETIME(),
    DeletedBy = 'migration-054-orphan-repair'
FROM dbo.BundleGenerationAllocation AS allocation
INNER JOIN RetiredBundles AS retired
  ON retired.Id = allocation.BundleGenerationId
WHERE allocation.IsDeleted = 0;

;WITH RetiredBundles AS (
  SELECT generation.Id
  FROM dbo.BundleGeneration AS generation
  WHERE generation.IsDeleted = 0
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.SewingCutReport AS report
      WHERE report.BundleGenerationId = generation.Id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.QrCode_Coupon AS coupon
      WHERE coupon.WorkOrder = generation.WorkOrder
        AND coupon.BundleNo = generation.BundleId
        AND coupon.Department = 'sewing'
        AND coupon.IsDeleted = 0
    )
)
UPDATE generation
SET IsDeleted = 1,
    DeletedAt = SYSUTCDATETIME(),
    DeletedBy = 'migration-054-orphan-repair'
FROM dbo.BundleGeneration AS generation
INNER JOIN RetiredBundles AS retired
  ON retired.Id = generation.Id;
