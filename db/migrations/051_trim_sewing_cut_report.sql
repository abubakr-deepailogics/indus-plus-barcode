-- SewingCutReport stores the sewing report grid snapshot only. Header and
-- Cut Planning-only values remain in their respective source tables.
ALTER TABLE dbo.SewingCutReport DROP COLUMN
  SaleOrderNo,
  CustomerName,
  OrderQty,
  FabricCode,
  Wash,
  Shrinkage,
  MarkerWidthCm,
  MarkerLengthM;
