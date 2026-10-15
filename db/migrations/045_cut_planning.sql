-- Migration 045: Sewing cut-marker planning entries.
-- This is PIT-owned transactional data. ERP size-wise quantities remain read-only
-- in indusPlus.dbo.S_WorkOrderSizeWiseQtyViewPITS.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CutPlanning' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.CutPlanning (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
    WorkOrder NVARCHAR(100) NOT NULL,
    PlanDate DATE NULL,
    SizeQuantitiesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_CutPlanning_SizeQuantities DEFAULT '{}',
    ReCutQty DECIMAL(18,3) NOT NULL CONSTRAINT DF_CutPlanning_ReCutQty DEFAULT 0,
    MarkerNo NVARCHAR(50) NULL,
    CutNo NVARCHAR(50) NULL,
    MarkerPlies DECIMAL(18,3) NOT NULL CONSTRAINT DF_CutPlanning_MarkerPlies DEFAULT 0,
    Shrinkage NVARCHAR(100) NULL,
    Shade NVARCHAR(100) NULL,
    CalculatedRequired DECIMAL(18,3) NULL,
    MarkerWidthCm DECIMAL(18,3) NULL,
    MarkerLengthM DECIMAL(18,3) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CutPlanning_IsDeleted DEFAULT 0,
    InsertedAt DATETIME2 NOT NULL CONSTRAINT DF_CutPlanning_InsertedAt DEFAULT SYSUTCDATETIME(),
    InsertedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
  );

  CREATE NONCLUSTERED INDEX IX_CutPlanning_WorkOrder_Active
    ON dbo.CutPlanning (WorkOrder, IsDeleted, PlanDate, Id);
END;
