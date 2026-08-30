-- Per-coupon identity: one row per (WorkOrder, BundleNo, OpNo). CouponCode is
-- the same value encoded in the printed QR, so it's stable across reprints —
-- generating the same work order again hits the unique constraint and the
-- existing row is reused instead of a duplicate being created.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'QrCode_Coupon' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.QrCode_Coupon (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    CouponCode  NVARCHAR(200)   NOT NULL,
    WorkOrder   NVARCHAR(100)   NOT NULL,
    BundleNo    NVARCHAR(100)   NOT NULL,
    OpNo        NVARCHAR(50)    NOT NULL,
    CreatedAt   DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_QrCode_Coupon_CouponCode UNIQUE (CouponCode)
  );
  CREATE INDEX IX_QrCode_Coupon_WorkOrder ON dbo.QrCode_Coupon (WorkOrder);
END
