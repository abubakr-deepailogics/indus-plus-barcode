-- Creates dbo.StyleBulletin_Attachment table to store file attachments (image/pdf) against a work order.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StyleBulletin_Attachment' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.StyleBulletin_Attachment (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    WorkOrder NVARCHAR(100) NOT NULL,
    FileName NVARCHAR(260) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    FileData VARBINARY(MAX) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL
  );

  CREATE INDEX IX_StyleBulletin_Attachment_WorkOrder ON dbo.StyleBulletin_Attachment(WorkOrder);
END
