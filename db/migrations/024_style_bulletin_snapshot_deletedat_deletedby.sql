-- Adds DeletedAt/DeletedBy to the two pitSystem-owned snapshot tables (see
-- 022_style_bulletin_snapshot_isdeleted.sql for IsDeleted), mirroring
-- dbo.QrCode_Coupon's own DeletedAt/DeletedBy
-- (013_qrcode_coupon_soft_delete.sql). Populated by the same delete-cascade
-- in POST /api/coupons/unscan-or-delete/delete that sets IsDeleted = 1, so
-- a soft-deleted snapshot row records who deleted it and when, not just
-- that it's deleted. NULL until then, same as QrCode_Coupon's columns.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.StyleBullettinInt') AND name = 'DeletedAt'
)
BEGIN
  ALTER TABLE dbo.StyleBullettinInt ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.StyleBullettinInt') AND name = 'DeletedBy'
)
BEGIN
  ALTER TABLE dbo.StyleBullettinInt ADD DeletedBy NVARCHAR(100) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND name = 'DeletedAt'
)
BEGIN
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND name = 'DeletedBy'
)
BEGIN
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD DeletedBy NVARCHAR(100) NULL;
END
