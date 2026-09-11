-- Migration 019: Employee Wages Persistence & Protection
-- Target DB: PIT-System (MSSQL_PIT_SYSTEM_CONNECTION_STRING)

-- 1. EmployeeWages header table
IF OBJECT_ID('dbo.EmployeeWages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmployeeWages (
        WageId        INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeCode  NVARCHAR(50)      NOT NULL,
        FromDate      DATE              NULL,
        ToDate        DATE              NULL,
        TotalCoupons  INT               NOT NULL DEFAULT 0,
        TotalQty      INT               NOT NULL DEFAULT 0,
        TotalAmount   DECIMAL(18, 2)    NOT NULL DEFAULT 0.00,
        CreatedBy     NVARCHAR(100)     NULL,
        CreatedAt     DATETIME          NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_EmployeeWages_EmployeeCode ON dbo.EmployeeWages(EmployeeCode);
    CREATE INDEX IX_EmployeeWages_Dates ON dbo.EmployeeWages(FromDate, ToDate);
END;

-- 2. EmployeeWageCoupons detail table
IF OBJECT_ID('dbo.EmployeeWageCoupons', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmployeeWageCoupons (
        WageCouponId INT IDENTITY(1,1) PRIMARY KEY,
        WageId       INT               NOT NULL,
        CouponCode   NVARCHAR(200)     NOT NULL,
        EmployeeCode NVARCHAR(50)      NOT NULL,
        Qty          INT               NULL,
        Rate         DECIMAL(18, 4)    NULL,
        Amount       DECIMAL(18, 2)    NOT NULL,
        CreatedAt    DATETIME          NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EmployeeWageCoupons_WageId FOREIGN KEY (WageId) REFERENCES dbo.EmployeeWages(WageId) ON DELETE CASCADE
    );

    CREATE INDEX IX_EmployeeWageCoupons_CouponCode ON dbo.EmployeeWageCoupons(CouponCode);
    CREATE INDEX IX_EmployeeWageCoupons_WageId ON dbo.EmployeeWageCoupons(WageId);
    CREATE INDEX IX_EmployeeWageCoupons_EmployeeCode ON dbo.EmployeeWageCoupons(EmployeeCode);
END;

-- 3. Update QrCode_Coupon table with IsWageCalculated and WageId
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IsWageCalculated'
)
BEGIN
    ALTER TABLE dbo.QrCode_Coupon ADD IsWageCalculated BIT NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'WageId'
)
BEGIN
    ALTER TABLE dbo.QrCode_Coupon ADD WageId INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IX_QrCode_Coupon_IsWageCalculated'
)
BEGIN
    CREATE INDEX IX_QrCode_Coupon_IsWageCalculated ON dbo.QrCode_Coupon(IsWageCalculated);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IX_QrCode_Coupon_WageId'
)
BEGIN
    CREATE INDEX IX_QrCode_Coupon_WageId ON dbo.QrCode_Coupon(WageId);
END;
