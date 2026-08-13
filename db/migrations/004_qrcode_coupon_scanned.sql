-- Tracks whether a coupon has been scanned yet. Defaults to 0 (not
-- scanned) for both new rows and the ones already registered.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IsScanned'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD IsScanned BIT NOT NULL DEFAULT 0;
END
