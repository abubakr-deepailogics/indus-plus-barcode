-- Adds CutNo column to dbo.QrCode_Coupon table to track cut information.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'CutNo'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD CutNo NVARCHAR(50) NULL;
END
