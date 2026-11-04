-- Generated sewing bundles are retained for audit, but may be withdrawn before
-- any coupons exist.  Keep all three records in the same active/deleted state.
IF COL_LENGTH('dbo.BundleGeneration', 'IsDeleted') IS NULL
BEGIN
  ALTER TABLE dbo.BundleGeneration
    ADD IsDeleted BIT NOT NULL CONSTRAINT DF_BundleGeneration_IsDeleted DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(256) NULL;
END;

IF COL_LENGTH('dbo.SewingCutReport', 'IsDeleted') IS NULL
BEGIN
  ALTER TABLE dbo.SewingCutReport
    ADD IsDeleted BIT NOT NULL CONSTRAINT DF_SewingCutReport_IsDeleted DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(256) NULL;
END;

IF COL_LENGTH('dbo.BundleGenerationAllocation', 'IsDeleted') IS NULL
BEGIN
  ALTER TABLE dbo.BundleGenerationAllocation
    ADD IsDeleted BIT NOT NULL CONSTRAINT DF_BundleGenerationAllocation_IsDeleted DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(256) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BundleGeneration_WorkOrder_Active' AND object_id = OBJECT_ID('dbo.BundleGeneration'))
  CREATE INDEX IX_BundleGeneration_WorkOrder_Active ON dbo.BundleGeneration (WorkOrder, IsDeleted, Id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BundleGenerationAllocation_WorkOrderCutNo_Active' AND object_id = OBJECT_ID('dbo.BundleGenerationAllocation'))
  CREATE INDEX IX_BundleGenerationAllocation_WorkOrderCutNo_Active ON dbo.BundleGenerationAllocation (WorkOrder, CutNo, IsDeleted, BundleGenerationId);
