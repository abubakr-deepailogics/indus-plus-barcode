IF EXISTS (SELECT 1 FROM dbo.BundleGeneration WHERE BundleQty <> FLOOR(BundleQty))
  THROW 50001, 'Cannot make BundleQty integer: dbo.BundleGeneration contains fractional bundle quantities.', 1;

IF EXISTS (SELECT 1 FROM dbo.SewingCutReport WHERE BundleQty <> FLOOR(BundleQty))
  THROW 50002, 'Cannot make BundleQty integer: dbo.SewingCutReport contains fractional bundle quantities.', 1;

ALTER TABLE dbo.BundleGeneration ALTER COLUMN BundleQty DECIMAL(18,0) NOT NULL;
ALTER TABLE dbo.SewingCutReport ALTER COLUMN BundleQty DECIMAL(18,0) NOT NULL;
