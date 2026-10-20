-- PIT system: generated cutting bundles sourced from Cut Planning.
CREATE TABLE dbo.BundleGeneration (
  Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  WorkOrder NVARCHAR(100) NOT NULL,
  BundleSequence INT NOT NULL,
  BundleId NVARCHAR(32) NOT NULL,
  BundleQty DECIMAL(18,3) NOT NULL,
  SourceTransactionQty DECIMAL(18,3) NOT NULL,
  IsMerged BIT NOT NULL CONSTRAINT DF_BundleGeneration_IsMerged DEFAULT 0,
  CutNosJson NVARCHAR(MAX) NOT NULL,
  InsertedAt DATETIME2 NOT NULL CONSTRAINT DF_BundleGeneration_InsertedAt DEFAULT SYSUTCDATETIME(),
  InsertedBy NVARCHAR(256) NULL,
  CONSTRAINT UQ_BundleGeneration_BundleId UNIQUE (BundleId),
  CONSTRAINT UQ_BundleGeneration_WorkOrderSequence UNIQUE (WorkOrder, BundleSequence),
  CONSTRAINT CK_BundleGeneration_BundleQty CHECK (BundleQty > 0)
);

CREATE TABLE dbo.BundleGenerationSequence (
  WorkOrder NVARCHAR(100) NOT NULL PRIMARY KEY,
  LastSequence INT NOT NULL CONSTRAINT DF_BundleGenerationSequence_LastSequence DEFAULT 0,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_BundleGenerationSequence_UpdatedAt DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.BundleGenerationAllocation (
  Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  BundleGenerationId BIGINT NOT NULL,
  WorkOrder NVARCHAR(100) NOT NULL,
  CutNo NVARCHAR(100) NOT NULL,
  AllocatedQty DECIMAL(18,3) NOT NULL,
  CONSTRAINT FK_BundleGenerationAllocation_BundleGeneration
    FOREIGN KEY (BundleGenerationId) REFERENCES dbo.BundleGeneration(Id),
  CONSTRAINT CK_BundleGenerationAllocation_Qty CHECK (AllocatedQty > 0)
);

CREATE INDEX IX_BundleGenerationAllocation_WorkOrderCutNo
  ON dbo.BundleGenerationAllocation (WorkOrder, CutNo);
