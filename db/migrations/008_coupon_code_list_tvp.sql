-- Table type for passing a batch of coupon codes in one round trip (see
-- /api/coupons/scan/batch) — a scanner gun fires codes fast, so the client
-- debounces a burst into one array and this lets the server UPDATE + SELECT
-- all of them in a single query instead of one HTTP+DB round trip per code.
IF NOT EXISTS (SELECT 1 FROM sys.types WHERE name = 'CouponCodeListType' AND is_table_type = 1)
BEGIN
  CREATE TYPE dbo.CouponCodeListType AS TABLE (
    CouponCode NVARCHAR(200) NOT NULL PRIMARY KEY
  );
END
