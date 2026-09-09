-- Re-purposes Id on the two snapshot tables (see
-- 012_style_bulletin_snapshot.sql, 014_style_bulletin_snapshot_uuid_id.sql)
-- from a per-row unique key into a per-GENERATION tracking key: every
-- style-bulletin row and every cut-detail row written by the SAME
-- coupon-generation run (one call to snapshotWorkOrderBulletin) now gets
-- stamped with the SAME GUID, so you can trace "everything this one
-- generation touched" across both tables by that one Id. That means Id can
-- legitimately repeat across many rows within a run — which a PRIMARY KEY
-- constraint would reject outright — so the PK added in migration 014 has
-- to come off. Row uniqueness is unaffected: it was always enforced by the
-- natural-key UNIQUE constraints from migration 012
-- (UQ_StyleBullettinInt_Order_Op / UQ_SaleOrderPOCutDetail_WO_Bundle), which
-- this migration does not touch.
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.StyleBullettinInt') AND type = 'PK'
)
BEGIN
  DECLARE @pk1 NVARCHAR(128);
  SELECT @pk1 = kc.name FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.StyleBullettinInt') AND kc.type = 'PK';
  EXEC('ALTER TABLE dbo.StyleBullettinInt DROP CONSTRAINT [' + @pk1 + ']');
END

IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND type = 'PK'
)
BEGIN
  DECLARE @pk2 NVARCHAR(128);
  SELECT @pk2 = kc.name FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1') AND kc.type = 'PK';
  EXEC('ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 DROP CONSTRAINT [' + @pk2 + ']');
END
