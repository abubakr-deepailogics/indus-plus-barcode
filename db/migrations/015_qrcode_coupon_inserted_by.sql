-- Renames dbo.QrCode_Coupon.CreatedAt to InsertedAt (clearer pairing with
-- the new InsertedBy below), and adds InsertedBy — who generated this
-- coupon. Both are DB-only bookkeeping: InsertedAt is already shown to
-- users (Coupon Tracing's "Generated Datetime" column reads this value —
-- see src/app/industrial-engineering/coupon-tracing/page.tsx), so only the
-- rename changes there; InsertedBy is never selected into any API response
-- or shown in any screen.
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'CreatedAt'
)
BEGIN
  EXEC sp_rename 'dbo.QrCode_Coupon.CreatedAt', 'InsertedAt', 'COLUMN';
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'InsertedBy'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD InsertedBy NVARCHAR(100) NULL;
END
