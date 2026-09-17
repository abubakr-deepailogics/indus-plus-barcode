-- One row per (bundle × operation) combo saved from the Rework Coupon page
-- (src/app/industrial-engineering/rework-coupon/page.tsx). Unlike
-- QrCode_Coupon, CutNo is never looked up from indusPlus here — the page
-- doesn't auto-populate it, the user types it in manually before saving
-- (see BundleDetailTable's onCutNoChange prop) — so this table is a plain
-- audit/record of what was entered, not a coupon-identity table; it has no
-- CouponCode / uniqueness constraint and is never read back by the
-- scanning flow. Id is a shared per-save batch id (like QrCode_Coupon's Id
-- for a generation run) so every row one "Save" click produced can be
-- found later by that one Id.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ReworkCouponEntry' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.ReworkCouponEntry (
    RowId         INT IDENTITY(1,1) PRIMARY KEY,
    Id            UNIQUEIDENTIFIER NOT NULL,
    WorkOrder     NVARCHAR(50)     NOT NULL,
    SaleOrderNo   NVARCHAR(100)    NULL,
    CustomerName  NVARCHAR(200)    NULL,
    CutNo         NVARCHAR(50)     NOT NULL,  -- manually entered, never looked up
    Char          NVARCHAR(50)     NULL,
    BundleNo      NVARCHAR(100)    NOT NULL,
    Inseam        NVARCHAR(50)     NULL,
    Size          NVARCHAR(50)     NULL,
    Pcs           INT              NULL,
    Section       NVARCHAR(200)    NULL,
    SeqNo         NVARCHAR(50)     NULL,
    OpNo          NVARCHAR(50)     NOT NULL,
    OperationName NVARCHAR(200)    NULL,
    Smv           FLOAT            NULL,
    Rate          FLOAT            NULL,
    ReworkQty     INT              NULL,
    Remarks       NVARCHAR(500)    NULL,
    InsertedBy    NVARCHAR(200)    NOT NULL,
    InsertedAt    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_ReworkCouponEntry_WorkOrder ON dbo.ReworkCouponEntry (WorkOrder);
  CREATE INDEX IX_ReworkCouponEntry_Id ON dbo.ReworkCouponEntry (Id);
END
