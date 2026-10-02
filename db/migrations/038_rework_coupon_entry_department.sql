-- Rework cut details are production data, so they must carry the same
-- department ownership as the coupons generated from them. All historical
-- rows predate department separation and therefore belong to Sewing.
--
-- Keep every reference to the new column in dynamic SQL. SQL Server validates
-- an entire batch before running it, which otherwise makes a first-time ADD
-- fail when later statements in this migration mention Department.
IF OBJECT_ID('dbo.ReworkCouponEntry', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.ReworkCouponEntry', 'Department') IS NULL
  BEGIN
    EXEC(N'ALTER TABLE dbo.ReworkCouponEntry ADD Department NVARCHAR(50) NULL;');
  END;

  EXEC(N'
    UPDATE dbo.ReworkCouponEntry
    SET Department = ''sewing''
    WHERE Department IS NULL OR LTRIM(RTRIM(Department)) = '''';

    ALTER TABLE dbo.ReworkCouponEntry
    ALTER COLUMN Department NVARCHAR(50) NOT NULL;
  ');

  IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.ReworkCouponEntry')
      AND name = 'DF_ReworkCouponEntry_Department'
  )
  BEGIN
    EXEC(N'
      ALTER TABLE dbo.ReworkCouponEntry
      ADD CONSTRAINT DF_ReworkCouponEntry_Department DEFAULT ''sewing'' FOR Department;
    ');
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.ReworkCouponEntry')
      AND name = 'CK_ReworkCouponEntry_Department'
  )
  BEGIN
    EXEC(N'
      ALTER TABLE dbo.ReworkCouponEntry
      ADD CONSTRAINT CK_ReworkCouponEntry_Department
      CHECK (Department IN (''cutting'', ''sewing'', ''washing'', ''finishing'', ''gdp''));
    ');
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ReworkCouponEntry')
      AND name = 'IX_ReworkCouponEntry_Department_WorkOrder_Bundle'
  )
  BEGIN
    EXEC(N'
      CREATE INDEX IX_ReworkCouponEntry_Department_WorkOrder_Bundle
        ON dbo.ReworkCouponEntry (Department, WorkOrder, BundleNo);
    ');
  END;
END;
