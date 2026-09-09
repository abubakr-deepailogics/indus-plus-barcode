-- Id on both snapshot tables (see 012/014/016) is now a per-GENERATION
-- tracking key: a row only gets a meaningful Id once an actual coupon-
-- generation run has produced or refreshed it (see
-- style-bulletin-snapshot.service.ts). It was left NOT NULL DEFAULT NEWID()
-- from when the column was first added, which forced every pre-existing
-- row (the full-Indus backfill, and the column-add itself) to carry a
-- meaningless GUID it was never actually entitled to. Making it nullable —
-- and dropping the auto-generating default — means a non-null Id is now a
-- real signal ("a coupon-generation run touched this row"), and NULL means
-- exactly what it should: "never touched by one." Every existing row is
-- reset to NULL here since none of them, as of this migration, were
-- produced by a genuine app-triggered generation run.
IF EXISTS (
  SELECT 1 FROM sys.columns c
  WHERE c.object_id = OBJECT_ID('dbo.StyleBullettinInt') AND c.name = 'Id' AND c.is_nullable = 0
)
BEGIN
  DECLARE @df1 NVARCHAR(128);
  SELECT @df1 = dc.name FROM sys.default_constraints dc
    WHERE dc.parent_object_id = OBJECT_ID('dbo.StyleBullettinInt')
      AND dc.parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.StyleBullettinInt') AND name = 'Id');
  IF @df1 IS NOT NULL EXEC('ALTER TABLE dbo.StyleBullettinInt DROP CONSTRAINT [' + @df1 + ']');
  ALTER TABLE dbo.StyleBullettinInt ALTER COLUMN Id UNIQUEIDENTIFIER NULL;
  UPDATE dbo.StyleBullettinInt SET Id = NULL;
END

IF EXISTS (
  SELECT 1 FROM sys.columns c
  WHERE c.object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND c.name = 'Id' AND c.is_nullable = 0
)
BEGIN
  DECLARE @df2 NVARCHAR(128);
  SELECT @df2 = dc.name FROM sys.default_constraints dc
    WHERE dc.parent_object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1')
      AND dc.parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND name = 'Id');
  IF @df2 IS NOT NULL EXEC('ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 DROP CONSTRAINT [' + @df2 + ']');
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ALTER COLUMN Id UNIQUEIDENTIFIER NULL;
  UPDATE dbo.SaleOrderPOCutDetailViewV1 SET Id = NULL;
END
