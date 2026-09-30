-- Migration 030: Create dedicated CutReport table in PIT System DB for washing (and other departments)
-- Moves washing cut report storage out of dbo.SaleOrderPOCutDetailViewV1 into dbo.CutReport.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CutReport' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.CutReport (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
    WorkOrder NVARCHAR(100) NOT NULL,
    SaleOrderNo NVARCHAR(100) NULL,
    CustomerName NVARCHAR(250) NULL,
    OrderQty FLOAT NULL,
    FabricCode NVARCHAR(150) NULL,
    Wash NVARCHAR(100) NULL,
    Department NVARCHAR(50) NOT NULL DEFAULT 'washing',
    Cut NVARCHAR(50) NOT NULL,
    BundleId NVARCHAR(50) NOT NULL,
    BundleQty FLOAT NOT NULL,
    Inseam NVARCHAR(50) NULL,
    Size NVARCHAR(50) NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    InsertedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    InsertedBy NVARCHAR(100) NULL,
    DeletedAt DATETIME2 NULL,
    DeletedBy NVARCHAR(100) NULL
  );

  CREATE NONCLUSTERED INDEX IX_CutReport_WorkOrder_Dept
    ON dbo.CutReport (WorkOrder, Department, IsDeleted);

  CREATE NONCLUSTERED INDEX IX_CutReport_BundleId
    ON dbo.CutReport (BundleId);
END;

-- Migrate any existing washing records from old table into CutReport and remove them from old table
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND name = 'Department')
BEGIN
  INSERT INTO dbo.CutReport (
    WorkOrder,
    SaleOrderNo,
    CustomerName,
    OrderQty,
    FabricCode,
    Wash,
    Department,
    Cut,
    BundleId,
    BundleQty,
    Inseam,
    Size,
    IsDeleted,
    InsertedAt,
    InsertedBy,
    DeletedAt,
    DeletedBy
  )
  SELECT
    [Work Order #],
    [Sale Order No],
    [Customer Name],
    [Order Qty After % Add],
    [Fabric Code(Main Body)],
    [Wash],
    'washing',
    [Cut #],
    [Bundle Id],
    [Bundle Qty],
    Inseam,
    Size,
    IsDeleted,
    InsertedAt,
    InsertedBy,
    DeletedAt,
    DeletedBy
  FROM dbo.SaleOrderPOCutDetailViewV1
  WHERE Department = 'washing';

  DELETE FROM dbo.SaleOrderPOCutDetailViewV1
  WHERE Department = 'washing';
END;
