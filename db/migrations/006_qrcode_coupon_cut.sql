-- Cut number the coupon's bundle belongs to (Order_Po_Cut_Detail's Cut
-- column), stored at generation time so coupon tracing/filtering can query
-- it without joining back to cut detail. Nullable/optional, same as Section.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'CutNo'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD CutNo NVARCHAR(100) NULL;
END
