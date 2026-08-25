-- Table type for bulk coupon registration via TVP (see
-- coupon-registration.service.ts) — one round trip per chunk instead of
-- one INSERT...VALUES per row batch. Column shapes match dbo.QrCode_Coupon.
IF NOT EXISTS (SELECT 1 FROM sys.types WHERE name = 'CouponRowType' AND is_table_type = 1)
BEGIN
  CREATE TYPE dbo.CouponRowType AS TABLE (
    CouponCode  NVARCHAR(200)  NOT NULL,
    BundleNo    NVARCHAR(100)  NOT NULL,
    OpNo        NVARCHAR(50)   NOT NULL,
    Section     NVARCHAR(200)  NULL,
    CutNo       NVARCHAR(50)   NULL
  );
END

-- One-time column check moved here from registerCoupons (was an
-- IF NOT EXISTS ALTER TABLE run on every registration call).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'CutNo'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD CutNo NVARCHAR(50) NULL;
END
