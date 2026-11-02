-- Generated sewing bundles must be approved in Cut Report (per bundle or per
-- whole Cut) before Coupon Generation may list them or issue coupons for them.
-- New bundles default to unapproved.
IF COL_LENGTH('dbo.SewingCutReport', 'IsApproved') IS NULL
BEGIN
  ALTER TABLE dbo.SewingCutReport
    ADD IsApproved BIT NOT NULL CONSTRAINT DF_SewingCutReport_IsApproved DEFAULT 0,
        ApprovedAt DATETIME2 NULL,
        ApprovedBy NVARCHAR(256) NULL;

  -- Bundles that existed before approval was introduced were already usable by
  -- Coupon Generation; keep them that way. Only runs when the column is first
  -- added, and must be dynamic SQL because SQL Server compiles the batch before
  -- the ALTER TABLE above.
  EXEC(N'
    UPDATE dbo.SewingCutReport
    SET IsApproved = 1, ApprovedAt = SYSUTCDATETIME(), ApprovedBy = N''migration-056''
    WHERE IsDeleted = 0;
  ');
END;

-- Coupon Generation lists approved, active bundles per work order.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SewingCutReport_WorkOrder_Approved' AND object_id = OBJECT_ID('dbo.SewingCutReport'))
  EXEC(N'CREATE INDEX IX_SewingCutReport_WorkOrder_Approved ON dbo.SewingCutReport (WorkOrder, IsDeleted, IsApproved) INCLUDE (BundleId, CutNo);');
