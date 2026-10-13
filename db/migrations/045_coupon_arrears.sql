-- Late scans for a tenure that has already been paid are kept as arrears.
-- They remain unpaid (WageId NULL) until a later wage explicitly includes them.
IF COL_LENGTH('dbo.QrCode_Coupon', 'IsArrear') IS NULL
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD IsArrear BIT NOT NULL
    CONSTRAINT DF_QrCode_Coupon_IsArrear DEFAULT 0;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon')
    AND name = 'IX_QrCode_Coupon_Arrears'
)
BEGIN
  CREATE INDEX IX_QrCode_Coupon_Arrears
    ON dbo.QrCode_Coupon (Department, IsArrear, WageId, ScannedAt)
    INCLUDE (EmployeeCode, WorkOrder, BundleNo, OpNo);
END;
