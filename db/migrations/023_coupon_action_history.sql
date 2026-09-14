-- Append-only audit trail for coupon unscan/delete actions performed through
-- the bulk unscan-or-delete modal (see src/app/api/coupons/unscan-or-delete/
-- {unscan,delete}/route.ts) — who did what to which coupon and when, so
-- that history survives independently of QrCode_Coupon's own mutable
-- IsScanned/IsDeleted state. RowId is the real primary key (a plain
-- identity, not the shared per-generation Id used elsewhere) since every row
-- here is its own standalone event, never grouped/updated as a batch. No
-- route ever UPDATEs or DELETEs a row in this table — it is written to
-- exactly once, at the moment the action happens, and read only for
-- history/audit purposes.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'QrCode_Coupon_ActionHistory' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.QrCode_Coupon_ActionHistory (
    RowId             INT IDENTITY(1,1) PRIMARY KEY,
    CouponCode        NVARCHAR(200)   NOT NULL,
    WorkOrder         NVARCHAR(100)   NOT NULL,
    BundleNo          NVARCHAR(100)   NOT NULL,
    OpNo              NVARCHAR(50)    NOT NULL,
    CutNo             NVARCHAR(50)    NULL,
    Section           NVARCHAR(200)   NULL,
    GenerationId      UNIQUEIDENTIFIER NULL,   -- QrCode_Coupon.Id at the time of this action, for tracing back to the generation run
    Action            NVARCHAR(20)    NOT NULL, -- 'unscanned' | 'deleted'
    ActedBy           NVARCHAR(100)   NOT NULL,
    ActedAt           DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    Reason            NVARCHAR(500)   NULL,     -- not currently captured by any UI; reserved for a future reason input
    PriorEmployeeCode NVARCHAR(50)    NULL,     -- who had scanned this coupon immediately before this action (NULL if it wasn't scanned)
    PriorScannedAt    DATETIME2       NULL,
    CONSTRAINT CK_QrCode_Coupon_ActionHistory_Action CHECK (Action IN ('unscanned', 'deleted'))
  );
  CREATE INDEX IX_QrCode_Coupon_ActionHistory_CouponCode ON dbo.QrCode_Coupon_ActionHistory (CouponCode);
  CREATE INDEX IX_QrCode_Coupon_ActionHistory_WorkOrder ON dbo.QrCode_Coupon_ActionHistory (WorkOrder);
END
