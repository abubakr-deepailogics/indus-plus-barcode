-- Attachments belong to the production department that uploaded them.
-- Existing attachments predate department separation, so preserve their
-- historical Sewing behavior during the one-time backfill.
IF COL_LENGTH('dbo.StyleBulletin_Attachment', 'Department') IS NULL
BEGIN
  ALTER TABLE dbo.StyleBulletin_Attachment ADD Department NVARCHAR(50) NULL;
END;

UPDATE dbo.StyleBulletin_Attachment
SET Department = 'sewing'
WHERE Department IS NULL OR LTRIM(RTRIM(Department)) = '';

ALTER TABLE dbo.StyleBulletin_Attachment
ALTER COLUMN Department NVARCHAR(50) NOT NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_StyleBulletin_Attachment_WorkOrder_Department'
    AND object_id = OBJECT_ID('dbo.StyleBulletin_Attachment')
)
BEGIN
  CREATE INDEX IX_StyleBulletin_Attachment_WorkOrder_Department
    ON dbo.StyleBulletin_Attachment(WorkOrder, Department);
END;
