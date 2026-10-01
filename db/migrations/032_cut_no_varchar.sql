-- Migration 032: Cut no is now alphanumeric (e.g. 'T0002451'), not INT.
-- Converts every PITS-db cut column still typed as a numeric type to NVARCHAR(50), keeping nullability.
-- Idempotent: columns already NVARCHAR are skipped. The lookup runs in dynamic SQL so a missing table is skipped too.
DECLARE @targets TABLE (tbl SYSNAME, col SYSNAME);
INSERT INTO @targets VALUES
  ('QrCode_Coupon', 'CutNo'),
  ('CouponActionHistory', 'CutNo'),
  ('ReworkCouponEntry', 'CutNo'),
  ('CutReport', 'Cut'),
  ('SaleOrderPOCutDetailViewV1', 'Cut #');

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE dbo.' + QUOTENAME(t.tbl) + N' ALTER COLUMN ' + QUOTENAME(t.col)
             + N' NVARCHAR(50) ' + CASE WHEN c.is_nullable = 1 THEN N'NULL' ELSE N'NOT NULL' END + N';' + CHAR(10)
FROM @targets t
JOIN sys.columns c ON c.object_id = OBJECT_ID('dbo.' + t.tbl) AND c.name = t.col
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE ty.name NOT IN ('nvarchar', 'varchar');
IF @sql <> N'' EXEC sp_executesql @sql;

-- Table type used by the snapshot insert (012) is already NVARCHAR(50); nothing to change there.
