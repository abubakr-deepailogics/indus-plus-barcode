-- Stores a generated QR-coupon PDF once so it can be re-downloaded without
-- re-rendering thousands of QR codes on every request.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Barcode_Pdf_Batch')
BEGIN
  CREATE TABLE dbo.Barcode_Pdf_Batch (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    AnlNo         NVARCHAR(100)   NOT NULL,
    StyleCode     NVARCHAR(100)   NOT NULL,
    CardCount     INT             NOT NULL,
    Pdf           VARBINARY(MAX)  NOT NULL,
    CreatedAt     DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy     NVARCHAR(200)   NULL
  );

  CREATE INDEX IX_Barcode_Pdf_Batch_AnlNo ON dbo.Barcode_Pdf_Batch (AnlNo, CreatedAt DESC);
END
