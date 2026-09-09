-- Switches the hidden Id column on the two style-bulletin/cut-detail
-- snapshot tables (see 012_style_bulletin_snapshot.sql) from a sequential
-- IDENTITY int to a globally unique GUID. A sequential 1,2,3... id is only
-- unique within its own table and reveals row order/count; a GUID can be
-- generated/referenced independently and is the stable per-row tracking
-- key these tables exist for. Existing rows each get their own new GUID via
-- the column default — nothing else in this app reads/joins on Id (the
-- snapshot service always upserts by natural key — Order No + Operation
-- Code, or Work Order # + Bundle Id — never by Id), so this is safe to
-- change after the fact with no code changes required elsewhere.
IF EXISTS (
  SELECT 1 FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.StyleBullettinInt') AND c.name = 'Id' AND t.name = 'int'
)
BEGIN
  DECLARE @pk1 NVARCHAR(128);
  SELECT @pk1 = kc.name FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.StyleBullettinInt') AND kc.type = 'PK';
  IF @pk1 IS NOT NULL EXEC('ALTER TABLE dbo.StyleBullettinInt DROP CONSTRAINT [' + @pk1 + ']');
  ALTER TABLE dbo.StyleBullettinInt DROP COLUMN Id;
  ALTER TABLE dbo.StyleBullettinInt ADD Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
  ALTER TABLE dbo.StyleBullettinInt ADD CONSTRAINT PK_StyleBullettinInt_Id PRIMARY KEY (Id);
END

IF EXISTS (
  SELECT 1 FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND c.name = 'Id' AND t.name = 'int'
)
BEGIN
  DECLARE @pk2 NVARCHAR(128);
  SELECT @pk2 = kc.name FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND kc.type = 'PK';
  IF @pk2 IS NOT NULL EXEC('ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 DROP CONSTRAINT [' + @pk2 + ']');
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 DROP COLUMN Id;
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 ADD CONSTRAINT PK_SaleOrderPOCutDetail_Id PRIMARY KEY (Id);
END
