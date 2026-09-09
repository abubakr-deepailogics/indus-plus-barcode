-- Soft-delete support for dbo.QrCode_Coupon — coupons must never be hard
-- DELETEd; every read query is updated to filter WHERE IsDeleted = 0 (see
-- coupon-registration.service.ts, coupons/scan/route.ts,
-- report-summary-builder.service.ts). NOT NULL DEFAULT 0 backfills every
-- existing row to 0 automatically. No delete endpoint exists yet — these
-- columns are the tracking mechanism any future delete feature must write
-- through (softDeleteCoupons in coupon-registration.service.ts), never a
-- direct DELETE.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IsDeleted'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD IsDeleted BIT NOT NULL CONSTRAINT DF_QrCode_Coupon_IsDeleted DEFAULT 0;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'DeletedAt'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'DeletedBy'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD DeletedBy NVARCHAR(100) NULL;
END
