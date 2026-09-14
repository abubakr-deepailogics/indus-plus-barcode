-- Switches the style-bulletin/cut-detail snapshot tables (012) from
-- upsert-by-natural-key to append-only: one full row per coupon-generation
-- run instead of updating a prior run's row in place. The old MERGE
-- approach overwrote InsertedAt/InsertedBy-adjacent data columns on repeat
-- runs while leaving InsertedAt frozen at first capture, so there was no way
-- to tell when a row's data was actually last refreshed, and no history of
-- prior runs' values. Now every run's rows stand on their own, traceable by
-- Id (the generationId, see 016) and freshly timestamped by InsertedAt.
--
-- The natural-key UNIQUE constraints from 012 are what forced one-row-per-
-- key; they must come off to allow multiple generations' rows for the same
-- key to coexist.
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'UQ_StyleBullettinInt_Order_Op' AND parent_object_id = OBJECT_ID('dbo.StyleBullettinInt')
)
  ALTER TABLE dbo.StyleBullettinInt DROP CONSTRAINT [UQ_StyleBullettinInt_Order_Op];

IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'UQ_SaleOrderPOCutDetail_WO_Bundle' AND parent_object_id = OBJECT_ID('dbo.SaleOrderPOCutDetailViewV1')
)
  ALTER TABLE dbo.SaleOrderPOCutDetailViewV1 DROP CONSTRAINT [UQ_SaleOrderPOCutDetail_WO_Bundle];
