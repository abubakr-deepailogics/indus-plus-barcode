-- Adds SystemScannedAt column to dbo.QrCode_Coupon to record the actual real-time system timestamp when a coupon is scanned.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'SystemScannedAt'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD SystemScannedAt DATETIME NULL;
END
