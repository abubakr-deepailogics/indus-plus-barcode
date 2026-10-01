-- Keep this schema addition isolated: SQL Server validates the complete
-- batch before executing it, so later Department references must be in the
-- following migration.
IF COL_LENGTH('dbo.QrCode_Coupon', 'Department') IS NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.QrCode_Coupon ADD Department NVARCHAR(50) NULL;');
END;
