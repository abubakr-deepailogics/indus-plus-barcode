-- Section the coupon's operation belongs to (style bulletin's Section
-- column), so coupon tracing can show it without joining back to a style
-- bulletin table. Nullable/optional — older rows and sources with no
-- section info (e.g. rework) just show blank.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'Section'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon ADD Section NVARCHAR(200) NULL;
END
