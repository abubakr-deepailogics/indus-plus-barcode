-- Department is durable production ownership. Existing coupons were created
-- by the Sewing-only flow and are preserved as Sewing.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'Department')
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD Department NVARCHAR(50) NULL;
END;

UPDATE dbo.QrCode_Coupon SET Department = 'sewing' WHERE Department IS NULL;

ALTER TABLE dbo.QrCode_Coupon ALTER COLUMN Department NVARCHAR(50) NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'DF_QrCode_Coupon_Department')
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD CONSTRAINT DF_QrCode_Coupon_Department DEFAULT 'sewing' FOR Department;
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'CK_QrCode_Coupon_Department')
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD CONSTRAINT CK_QrCode_Coupon_Department
    CHECK (Department IN ('cutting', 'sewing', 'washing', 'finishing', 'gdp'));
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IX_QrCode_Coupon_Department_WorkOrder')
BEGIN
  CREATE INDEX IX_QrCode_Coupon_Department_WorkOrder
    ON dbo.QrCode_Coupon (Department, WorkOrder) WHERE IsDeleted = 0;
END;
