-- Migration 029: Add Department column to dbo.SaleOrderPOCutDetailViewV1
-- Distinguishes cut report records between manufacturing departments ('sewing', 'washing', 'finishing', 'gdp').
-- Existing records default to 'sewing'.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND name = 'Department'
)
BEGIN
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1
    ADD Department NVARCHAR(50) NULL CONSTRAINT DF_SaleOrderPOCutDetailViewV1_Department DEFAULT 'sewing';
END;

-- Backfill any existing records to 'sewing' using dynamic SQL so parser doesn't fail in single batch
EXEC(N'UPDATE dbo.SaleOrderPOCutDetailViewV1 SET Department = ''sewing'' WHERE Department IS NULL;');

-- Index for fast department-scoped work order cut lookups
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_SaleOrderPOCutDetail_WO_Dept' AND object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1')
)
BEGIN
  CREATE INDEX IX_SaleOrderPOCutDetail_WO_Dept
    ON dbo.SaleOrderPOCutDetailViewV1 ([Work Order #], [Department]);
END;
