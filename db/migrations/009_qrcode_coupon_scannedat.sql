-- ScannedAt was previously created by an ALTER TABLE IF NOT EXISTS check
-- that ran on every request in /api/coupons/scan (an anti-pattern per
-- AGENTS.md) — moved here as a one-time migration instead.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'ScannedAt'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD ScannedAt DATETIME NULL;
END
