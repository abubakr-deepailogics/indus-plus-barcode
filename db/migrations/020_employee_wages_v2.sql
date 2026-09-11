-- Migration 020: Employee Wages V2 — Operation-wise row storage
-- Target DB: PIT-System (MSSQL_PIT_SYSTEM_CONNECTION_STRING)
--
-- Replaces the per-coupon EmployeeWageCoupons table with EmployeeWageRows,
-- which stores one row per grouped operation entry (same format as the
-- Employees breakdown tab in the report UI).
-- QrCode_Coupon.IsWageCalculated and WageId remain — still used by scan guard.

-- 1. Drop old per-coupon detail table (no longer needed)
IF OBJECT_ID('dbo.EmployeeWageCoupons', 'U') IS NOT NULL
BEGIN
    -- FK constraint will be dropped automatically with the table
    DROP TABLE dbo.EmployeeWageCoupons;
END;

-- 2. Create new operation-wise detail table
IF OBJECT_ID('dbo.EmployeeWageRows', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmployeeWageRows (
        WageRowId    INT IDENTITY(1,1) PRIMARY KEY,
        WageId       INT               NOT NULL,
        EmployeeCode NVARCHAR(50)      NOT NULL,
        EmployeeName NVARCHAR(200)     NULL,
        WorkOrder    NVARCHAR(100)     NULL,
        WorkDate     NVARCHAR(20)      NULL,   -- stored as dd-MM-yy display string
        Operation    NVARCHAR(200)     NULL,
        Rate         DECIMAL(18,4)     NULL,
        BundleCount  INT               NOT NULL DEFAULT 0,
        Qty          INT               NOT NULL DEFAULT 0,
        TotalPay     DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
        CONSTRAINT FK_EmployeeWageRows_WageId
            FOREIGN KEY (WageId) REFERENCES dbo.EmployeeWages(WageId) ON DELETE CASCADE
    );

    CREATE INDEX IX_EmployeeWageRows_WageId       ON dbo.EmployeeWageRows(WageId);
    CREATE INDEX IX_EmployeeWageRows_EmployeeCode ON dbo.EmployeeWageRows(EmployeeCode);
END;
