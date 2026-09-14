-- Drops Reason from dbo.QrCode_Coupon_ActionHistory (023_coupon_action_history.sql) —
-- unused, nothing writes to it, no UI captures a reason. 023 itself is
-- edited in place to no longer create this column on a fresh install; this
-- migration removes it from databases where 023 already ran.
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon_ActionHistory') AND name = 'Reason'
)
BEGIN
  ALTER TABLE dbo.QrCode_Coupon_ActionHistory DROP COLUMN Reason;
END
