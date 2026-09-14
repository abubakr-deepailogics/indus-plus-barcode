-- Adds soft-delete tracking to the two pitSystem-owned snapshot tables (see
-- 012_style_bulletin_snapshot.sql), mirroring dbo.QrCode_Coupon's own
-- IsDeleted (013_qrcode_coupon_soft_delete.sql). When a coupon is deleted
-- (POST /api/coupons/unscan-or-delete/delete), every StyleBullettinInt /
-- SaleOrderPOCutDetailViewV1 row sharing that coupon's generation Id is
-- marked IsDeleted = 1 too, so that batch's data stops surfacing on report
-- pages — see style-bulletin-snapshot cascading in the delete route, and the
-- `AND IsDeleted = 0` filters added to styleBulletinSnapshotByFilter /
-- cutDetailSnapshotByFilter (src/lib/db.ts) and the report-summary-builder
-- pitSystem reads. NOT NULL DEFAULT 0 backfills every existing row to 0
-- automatically. Never a hard DELETE, same rule as QrCode_Coupon.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.StyleBullettinInt') AND name = 'IsDeleted'
)
BEGIN
  ALTER TABLE dbo.StyleBullettinInt ADD IsDeleted BIT NOT NULL CONSTRAINT DF_StyleBullettinInt_IsDeleted DEFAULT 0;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND name = 'IsDeleted'
)
BEGIN
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD IsDeleted BIT NOT NULL CONSTRAINT DF_SaleOrderPOCutDetailViewV1_IsDeleted DEFAULT 0;
END
