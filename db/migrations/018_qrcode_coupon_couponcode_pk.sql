-- Makes dbo.QrCode_Coupon.CouponCode the real PRIMARY KEY (it was already
-- unique via UQ_QrCode_Coupon_CouponCode since 003_qrcode_coupon.sql, and
-- is the actual business identity of a coupon — the value printed/encoded
-- on the physical QR/barcode). The old Id IDENTITY column is demoted to the
-- same per-GENERATION tracking key used on the style-bulletin/cut-detail
-- snapshot tables (see 016/017_style_bulletin_snapshot_*.sql): nullable,
-- no default, not unique — every coupon inserted by the SAME coupon-
-- generation run shares one Id (see coupon-registration.service.ts /
-- style-bulletin-snapshot.service.ts, which now share one generationId
-- across all three tables for a single "Generate Coupons" action).
--
-- Callers that ordered by Id for stable pagination (listCoupons/
-- listAllCoupons in coupon-registration.service.ts) now order by
-- CouponCode instead — Id is no longer unique or sequential, so it can no
-- longer serve that role; CouponCode already is unique now, so this is a
-- like-for-like swap.
IF EXISTS (
  SELECT 1 FROM sys.columns c
  WHERE c.object_id = OBJECT_ID('dbo.QrCode_Coupon') AND c.name = 'Id'
    AND EXISTS (SELECT 1 FROM sys.identity_columns ic WHERE ic.object_id = c.object_id AND ic.column_id = c.column_id)
)
BEGIN
  DECLARE @pk NVARCHAR(128);
  SELECT @pk = kc.name FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.QrCode_Coupon') AND kc.type = 'PK';
  IF @pk IS NOT NULL EXEC('ALTER TABLE dbo.QrCode_Coupon DROP CONSTRAINT [' + @pk + ']');

  DECLARE @uq NVARCHAR(128);
  SELECT @uq = kc.name FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.QrCode_Coupon') AND kc.type = 'UQ';
  IF @uq IS NOT NULL EXEC('ALTER TABLE dbo.QrCode_Coupon DROP CONSTRAINT [' + @uq + ']');

  ALTER TABLE dbo.QrCode_Coupon DROP COLUMN Id;
  ALTER TABLE dbo.QrCode_Coupon ADD Id UNIQUEIDENTIFIER NULL;

  ALTER TABLE dbo.QrCode_Coupon ADD CONSTRAINT PK_QrCode_Coupon_CouponCode PRIMARY KEY (CouponCode);
END
