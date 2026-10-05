-- Manually-entered bundle details for departments that do not receive cut
-- details from ERP (currently Washing; reusable by Finishing later).
CREATE TABLE dbo.ManualCouponCutDetail (
  RowId       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  WorkOrder   NVARCHAR(50) NOT NULL,
  Department  NVARCHAR(50) NOT NULL,
  BundleNo    NVARCHAR(100) NOT NULL,
  Inseam      NVARCHAR(50) NULL,
  Size        NVARCHAR(50) NULL,
  Pcs         INT NOT NULL,
  CONSTRAINT UQ_ManualCouponCutDetail_Department_WorkOrder_Bundle
    UNIQUE (Department, WorkOrder, BundleNo),
  CONSTRAINT CK_ManualCouponCutDetail_Department
    CHECK (Department IN ('cutting', 'sewing', 'washing', 'finishing', 'gdp')),
  CONSTRAINT CK_ManualCouponCutDetail_Pcs
    CHECK (Pcs > 0)
);

CREATE INDEX IX_ManualCouponCutDetail_Department_WorkOrder
  ON dbo.ManualCouponCutDetail (Department, WorkOrder);
