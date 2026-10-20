-- Sewing Cut Report snapshot history. Kept separate from dbo.CutReport,
-- which is owned by the washing flow.
CREATE TABLE dbo.SewingCutReport (
  RowId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  BundleGenerationId BIGINT NOT NULL,
  WorkOrder NVARCHAR(100) NOT NULL,
  SaleOrderNo NVARCHAR(100) NULL,
  CustomerName NVARCHAR(255) NULL,
  OrderQty DECIMAL(18,3) NULL,
  Inseam INT NULL,
  Size NVARCHAR(50) NULL,
  Color NVARCHAR(255) NULL,
  FabricCode NVARCHAR(MAX) NULL,
  Wash NVARCHAR(255) NULL,
  CutNo NVARCHAR(100) NULL,
  BundleId NVARCHAR(32) NOT NULL,
  BundleQty DECIMAL(18,3) NOT NULL,
  Shade NVARCHAR(100) NULL,
  Shrinkage NVARCHAR(100) NULL,
  MarkerWidthCm DECIMAL(18,3) NULL,
  MarkerLengthM DECIMAL(18,3) NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SewingCutReport_CreatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy NVARCHAR(256) NULL,
  CONSTRAINT FK_SewingCutReport_BundleGeneration
    FOREIGN KEY (BundleGenerationId) REFERENCES dbo.BundleGeneration(Id),
  CONSTRAINT UQ_SewingCutReport_BundleGeneration UNIQUE (BundleGenerationId)
);

CREATE INDEX IX_SewingCutReport_WorkOrder ON dbo.SewingCutReport (WorkOrder, CreatedAt DESC);
