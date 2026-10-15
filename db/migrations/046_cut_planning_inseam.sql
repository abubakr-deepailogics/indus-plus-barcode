-- Migration 046: Preserve the ERP Inseam that owns each cut-planning block.
IF COL_LENGTH('dbo.CutPlanning', 'SourceInseam') IS NULL
BEGIN
  ALTER TABLE dbo.CutPlanning ADD SourceInseam INT NULL;
  CREATE NONCLUSTERED INDEX IX_CutPlanning_WorkOrder_Inseam_Active
    ON dbo.CutPlanning (WorkOrder, SourceInseam, IsDeleted, PlanDate, Id);
END;
