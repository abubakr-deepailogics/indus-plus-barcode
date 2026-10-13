-- Arrears are inferred from an unpaid coupon (WageId IS NULL) whose scan date
-- is inside an existing paid tenure. No per-coupon flag is required.
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon')
    AND name = 'IX_QrCode_Coupon_Arrears'
)
BEGIN
  DROP INDEX IX_QrCode_Coupon_Arrears ON dbo.QrCode_Coupon;
END;

IF COL_LENGTH('dbo.QrCode_Coupon', 'IsArrear') IS NOT NULL
BEGIN
  DECLARE @arrearDefaultConstraint NVARCHAR(255) = (
    SELECT dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.QrCode_Coupon')
      AND c.name = 'IsArrear'
  );

  IF @arrearDefaultConstraint IS NOT NULL
  BEGIN
    DECLARE @dropDefaultSql NVARCHAR(512) =
      N'ALTER TABLE dbo.QrCode_Coupon DROP CONSTRAINT ' + QUOTENAME(@arrearDefaultConstraint);
    EXEC(@dropDefaultSql);
  END;

  ALTER TABLE dbo.QrCode_Coupon DROP COLUMN IsArrear;
END;
