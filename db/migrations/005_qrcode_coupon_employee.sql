-- Adds EmployeeCode and ScanBy columns to dbo.QrCode_Coupon table to track scanner information.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'EmployeeCode'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD EmployeeCode NVARCHAR(100) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'ScanBy'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD ScanBy NVARCHAR(100) NULL;
END
