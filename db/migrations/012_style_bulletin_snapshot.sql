-- PIT-owned local copies of the two indusPlus (ERP, read-only) sources this
-- app relies on for coupon generation: dbo.StyleBullettinInt (style
-- bulletin/operations) and dbo.SaleOrderPOCutDetailViewV1 (work order/cut
-- detail). Column names mirror the Indus originals exactly (see
-- STYLE_BULLETIN_TABLE/CUT_DETAIL_VIEW in src/lib/db.ts); Id/InsertedAt/
-- InsertedBy are this app's own hidden tracking columns, never surfaced to
-- any API response. Populated by
-- src/features/order-style-bulletin/services/style-bulletin-snapshot.service.ts
-- at coupon-generation time — see db/migrations/013 for why this exists on
-- pitSystem and not indusPlus (no CREATE TABLE permission there).
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StyleBullettinInt]') AND type = N'U')
BEGIN
  CREATE TABLE [dbo].[StyleBullettinInt] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Sale order No] NVARCHAR(100) NULL,
    [Customer Name] NVARCHAR(200) NULL,
    [Order No] NVARCHAR(50) NOT NULL,
    [Operation Code] NVARCHAR(50) NOT NULL,
    [Operation Name] NVARCHAR(200) NULL,
    [Section] NVARCHAR(200) NULL,
    [Operation Sequeance] NVARCHAR(50) NULL,
    [Machine Type] NVARCHAR(100) NULL,
    [Piece Rate] FLOAT NULL,
    [Smv/Sam] FLOAT NULL,
    [First Operation Section Wise] NVARCHAR(50) NULL,
    [Last Operation Section Wise] NVARCHAR(50) NULL,
    [InsertedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [InsertedBy] NVARCHAR(100) NULL,
    CONSTRAINT [UQ_StyleBullettinInt_Order_Op] UNIQUE ([Order No], [Operation Code])
  );
  CREATE INDEX [IX_StyleBullettinInt_OrderNo] ON [dbo].[StyleBullettinInt] ([Order No]);
END

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SaleOrderPOCutDetailViewV1]') AND type = N'U')
BEGIN
  CREATE TABLE [dbo].[SaleOrderPOCutDetailViewV1] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Sale Order No] NVARCHAR(100) NULL,
    [Customer Name] NVARCHAR(200) NULL,
    [Work Order #] NVARCHAR(50) NOT NULL,
    [Order Qty After % Add] FLOAT NULL,
    [Inseam] NVARCHAR(50) NULL,
    [Size] NVARCHAR(50) NULL,
    [Color] NVARCHAR(50) NULL,
    [Fabric Code(Main Body)] NVARCHAR(100) NULL,
    [Wash] NVARCHAR(50) NULL,
    [Cut #] NVARCHAR(50) NULL,
    [Bundle Id] NVARCHAR(50) NOT NULL,
    [Bundle Qty] FLOAT NULL,
    [Shade] NVARCHAR(50) NULL,
    [Shrinkage] NVARCHAR(50) NULL,
    [InsertedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [InsertedBy] NVARCHAR(100) NULL,
    CONSTRAINT [UQ_SaleOrderPOCutDetail_WO_Bundle] UNIQUE ([Work Order #], [Bundle Id])
  );
  CREATE INDEX [IX_SaleOrderPOCutDetail_WorkOrder] ON [dbo].[SaleOrderPOCutDetailViewV1] ([Work Order #]);
END

-- Bulk-upsert transport TVPs for the snapshot service (same reasoning as
-- dbo.CouponRowType in 007_qrcode_coupon_tvp.sql — one MERGE round trip per
-- work order instead of one round trip per row). Plain identifiers here are
-- fine: these are never queried directly, only passed as table-valued
-- parameters, so they don't need to mirror the bracketed Indus names.
IF NOT EXISTS (SELECT 1 FROM sys.types WHERE name = 'StyleBulletinSnapshotRowType' AND is_table_type = 1)
BEGIN
  CREATE TYPE dbo.StyleBulletinSnapshotRowType AS TABLE (
    SaleOrderNo NVARCHAR(100) NULL,
    CustomerName NVARCHAR(200) NULL,
    OrderNo NVARCHAR(50) NOT NULL,
    OperationCode NVARCHAR(50) NOT NULL,
    OperationName NVARCHAR(200) NULL,
    Section NVARCHAR(200) NULL,
    OperationSequence NVARCHAR(50) NULL,
    MachineType NVARCHAR(100) NULL,
    PieceRate FLOAT NULL,
    SmvSam FLOAT NULL,
    FirstOpSectionWise NVARCHAR(50) NULL,
    LastOpSectionWise NVARCHAR(50) NULL
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.types WHERE name = 'CutDetailSnapshotRowType' AND is_table_type = 1)
BEGIN
  CREATE TYPE dbo.CutDetailSnapshotRowType AS TABLE (
    SaleOrderNo NVARCHAR(100) NULL,
    CustomerName NVARCHAR(200) NULL,
    WorkOrder NVARCHAR(50) NOT NULL,
    OrderQtyAfterAdd FLOAT NULL,
    Inseam NVARCHAR(50) NULL,
    Size NVARCHAR(50) NULL,
    Color NVARCHAR(50) NULL,
    FabricCodeMainBody NVARCHAR(100) NULL,
    Wash NVARCHAR(50) NULL,
    Cut NVARCHAR(50) NULL,
    BundleId NVARCHAR(50) NOT NULL,
    BundleQty FLOAT NULL,
    Shade NVARCHAR(50) NULL,
    Shrinkage NVARCHAR(50) NULL
  );
END
