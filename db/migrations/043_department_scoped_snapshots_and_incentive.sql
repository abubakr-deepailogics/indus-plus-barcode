-- Freeze department and per-piece incentive with every coupon-generation
-- snapshot. This prevents a later ERP edit, or another department using the
-- same work order, operation, or bundle number, from changing PIT reports.
IF COL_LENGTH('dbo.StyleBullettinInt', 'Department') IS NULL
BEGIN
  ALTER TABLE dbo.StyleBullettinInt ADD Department NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.SaleOrderPOCutDetailViewV1', 'Department') IS NULL
BEGIN
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD Department NVARCHAR(20) NULL;
END;

-- Generation Id joins new snapshot rows to their generated coupons. Older
-- rows that pre-date this relationship safely retain the legacy Sewing scope.
EXEC(N'
  UPDATE sb SET Department = COALESCE(src.Department, ''sewing'')
  FROM dbo.StyleBullettinInt sb
  OUTER APPLY (
    SELECT TOP (1) c.Department
    FROM dbo.QrCode_Coupon c
    WHERE c.Id = sb.Id AND c.WorkOrder = sb.[Order No]
      AND c.OpNo = sb.[Operation Code]
    ORDER BY c.InsertedAt DESC
  ) src
  WHERE sb.Department IS NULL;

  UPDATE cd SET Department = COALESCE(src.Department, ''sewing'')
  FROM dbo.SaleOrderPOCutDetailViewV1 cd
  OUTER APPLY (
    SELECT TOP (1) c.Department
    FROM dbo.QrCode_Coupon c
    WHERE c.Id = cd.Id AND c.WorkOrder = cd.[Work Order #]
      AND c.BundleNo = cd.[Bundle Id]
    ORDER BY c.InsertedAt DESC
  ) src
  WHERE cd.Department IS NULL;
');

-- Existing installations can already have a nullable Department column with
-- an index created by an earlier migration. Backfill all nulls above rather
-- than altering its nullability and invalidating that live index.

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_StyleBullettinInt_Department')
BEGIN
  EXEC(N'ALTER TABLE dbo.StyleBullettinInt ADD CONSTRAINT CK_StyleBullettinInt_Department
    CHECK (Department IN (''cutting'', ''sewing'', ''washing'', ''finishing'', ''gdp''));');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SaleOrderPOCutDetail_Department')
BEGIN
  EXEC(N'ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD CONSTRAINT CK_SaleOrderPOCutDetail_Department
    CHECK (Department IN (''cutting'', ''sewing'', ''washing'', ''finishing'', ''gdp''));');
END;

IF COL_LENGTH('dbo.StyleBullettinInt', 'Incentive') IS NULL
BEGIN
  ALTER TABLE dbo.StyleBullettinInt ADD Incentive DECIMAL(18,4) NOT NULL
    CONSTRAINT DF_StyleBullettinInt_Incentive DEFAULT 0;
END;

IF COL_LENGTH('dbo.StyleBullettinInt', 'IncentiveCaptured') IS NULL
BEGIN
  ALTER TABLE dbo.StyleBullettinInt ADD IncentiveCaptured BIT NOT NULL
    CONSTRAINT DF_StyleBullettinInt_IncentiveCaptured DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StyleBullettinInt_Department_Order_Op_InsertedAt')
BEGIN
  EXEC(N'CREATE INDEX IX_StyleBullettinInt_Department_Order_Op_InsertedAt
    ON dbo.StyleBullettinInt (Department, [Order No], [Operation Code], InsertedAt DESC);');
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaleOrderPOCutDetail_Department_WorkOrder_Bundle_InsertedAt')
BEGIN
  EXEC(N'CREATE INDEX IX_SaleOrderPOCutDetail_Department_WorkOrder_Bundle_InsertedAt
    ON dbo.SaleOrderPOCutDetailViewV1 (Department, [Work Order #], [Bundle Id], InsertedAt DESC);');
END;

-- The Node driver validates TVP columns against this type. Recreate it with
-- the frozen incentive column; there are no stored procedures bound to it.
IF EXISTS (SELECT 1 FROM sys.table_types WHERE name = 'StyleBulletinSnapshotRowType' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  DROP TYPE dbo.StyleBulletinSnapshotRowType;
END;

EXEC(N'
  CREATE TYPE dbo.StyleBulletinSnapshotRowType AS TABLE (
    SaleOrderNo NVARCHAR(100) NULL,
    CustomerName NVARCHAR(200) NULL,
    OrderNo NVARCHAR(50) NOT NULL,
    OperationCode NVARCHAR(50) NOT NULL,
    OperationName NVARCHAR(200) NULL,
    Section NVARCHAR(200) NULL,
    OperationSequence NVARCHAR(50) NULL,
    MachineType NVARCHAR(100) NULL,
    PieceRate FLOAT NULL,
    SmvSam FLOAT NULL,
    FirstOpSectionWise NVARCHAR(50) NULL,
    LastOpSectionWise NVARCHAR(50) NULL,
    Incentive DECIMAL(18,4) NOT NULL
  );
');
