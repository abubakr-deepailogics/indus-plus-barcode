-- BundleId now restarts at 0001 for every Work Order (no more WorkOrder-digit
-- prefix) instead of being drawn from one continuing, globally unique list.
-- Uniqueness no longer holds on BundleId alone, so it moves to a (WorkOrder,
-- BundleId) constraint, and a hidden Uid column backs the row's identity.
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_BundleGeneration_BundleId' AND parent_object_id = OBJECT_ID('dbo.BundleGeneration'))
  ALTER TABLE dbo.BundleGeneration DROP CONSTRAINT UQ_BundleGeneration_BundleId;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_BundleGeneration_WorkOrderBundleId' AND parent_object_id = OBJECT_ID('dbo.BundleGeneration'))
  ALTER TABLE dbo.BundleGeneration ADD CONSTRAINT UQ_BundleGeneration_WorkOrderBundleId UNIQUE (WorkOrder, BundleId);

IF COL_LENGTH('dbo.BundleGeneration', 'Uid') IS NULL
BEGIN
  ALTER TABLE dbo.BundleGeneration
    ADD Uid UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_BundleGeneration_Uid DEFAULT NEWID();

  ALTER TABLE dbo.BundleGeneration
    ADD CONSTRAINT UQ_BundleGeneration_Uid UNIQUE (Uid);
END;
