-- CouponCode is the physical barcode primary key. This index protects the
-- business identity too, so one department can never register the same work
-- order / bundle / operation twice under different barcode formatting.
-- Existing PIT-System data was verified before adding this migration: no
-- duplicate rows exist for this key.
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon')
    AND name = 'UX_QrCode_Coupon_Department_WorkItem'
)
BEGIN
  CREATE UNIQUE INDEX UX_QrCode_Coupon_Department_WorkItem
    ON dbo.QrCode_Coupon (Department, WorkOrder, BundleNo, OpNo);
END;
