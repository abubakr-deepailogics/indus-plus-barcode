-- Bundle numbers are now the lowest free number among a Work Order's ACTIVE
-- bundles: delete 0001 while 0002/0003 exist and the next bundle is 0001
-- again. The soft-deleted row keeps its number, so uniqueness must only
-- hold among active rows: both table-wide unique constraints become
-- filtered unique indexes (IsDeleted = 0).
--
-- dbo.BundleGenerationSequence is no longer read or written (generation
-- serializes per Work Order with sp_getapplock instead). It is left in place
-- so an older build still running against this database keeps working.
-- Drop it once no such build remains.
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_BundleGeneration_WorkOrderBundleId' AND parent_object_id = OBJECT_ID('dbo.BundleGeneration'))
  ALTER TABLE dbo.BundleGeneration DROP CONSTRAINT UQ_BundleGeneration_WorkOrderBundleId;

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_BundleGeneration_WorkOrderSequence' AND parent_object_id = OBJECT_ID('dbo.BundleGeneration'))
  ALTER TABLE dbo.BundleGeneration DROP CONSTRAINT UQ_BundleGeneration_WorkOrderSequence;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_BundleGeneration_WorkOrderBundleId_Active' AND object_id = OBJECT_ID('dbo.BundleGeneration'))
  CREATE UNIQUE INDEX UX_BundleGeneration_WorkOrderBundleId_Active
    ON dbo.BundleGeneration (WorkOrder, BundleId)
    WHERE IsDeleted = 0;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_BundleGeneration_WorkOrderSequence_Active' AND object_id = OBJECT_ID('dbo.BundleGeneration'))
  CREATE UNIQUE INDEX UX_BundleGeneration_WorkOrderSequence_Active
    ON dbo.BundleGeneration (WorkOrder, BundleSequence)
    INCLUDE (BundleId)
    WHERE IsDeleted = 0;
