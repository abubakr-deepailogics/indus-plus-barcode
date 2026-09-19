-- Migration 027: Update dbo.ReworkCouponEntry to store cut-only details
-- Operation details are already stored in dbo.StyleBullettinInt, so OpNo is no longer required in ReworkCouponEntry.
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.ReworkCouponEntry') AND name = 'OpNo'
)
BEGIN
  ALTER TABLE dbo.ReworkCouponEntry ALTER COLUMN OpNo NVARCHAR(50) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_ReworkCouponEntry_WO_Bundle' AND object_id = OBJECT_ID('dbo.ReworkCouponEntry')
)
BEGIN
  CREATE INDEX IX_ReworkCouponEntry_WO_Bundle ON dbo.ReworkCouponEntry (WorkOrder, BundleNo);
END
