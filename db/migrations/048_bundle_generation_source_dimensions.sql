ALTER TABLE dbo.BundleGeneration
  ADD SourceInseam INT NULL,
      SourceSize NVARCHAR(50) NULL;

ALTER TABLE dbo.BundleGenerationAllocation
  ADD SourceInseam INT NULL,
      SourceSize NVARCHAR(50) NULL;

CREATE INDEX IX_BundleGenerationAllocation_Source
  ON dbo.BundleGenerationAllocation (WorkOrder, CutNo, SourceInseam, SourceSize);
