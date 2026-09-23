-- Migration 028: Wages redesign — titled, tenure-scoped wage batches
-- Target DB: PIT-System (MSSQL_PIT_SYSTEM_CONNECTION_STRING)
--
-- A wage is now created for a TENURE (FromDate..ToDate) and covers every
-- scanned coupon in that range — not a filtered employee subset. Scanning is
-- locked by asking whether a scan date falls inside any wage's tenure, which
-- replaces the per-coupon IsWageCalculated flag. That flag only ever marked
-- rows existing at generation time, so coupons scanned into an already-paid
-- date afterwards stayed unlocked; a date-range check closes that hole.
--
-- No GO separators: scripts/migrate.mjs sends each file as ONE batch inside a
-- transaction, and `GO` is a client-side separator mssql does not split on.
-- Statements that reference a column added earlier in this same file are
-- wrapped in EXEC('...') so they compile at run time rather than when the
-- batch is parsed — deferred name resolution, same single-batch reason.

-- 1. Title on the wage header. Added NULL first so existing rows survive,
--    backfilled, then tightened to NOT NULL.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'Title'
)
BEGIN
    ALTER TABLE dbo.EmployeeWages ADD Title NVARCHAR(200) NULL;
    EXEC('UPDATE dbo.EmployeeWages SET Title = CONCAT(''Wage #'', WageId) WHERE Title IS NULL;');
    EXEC('ALTER TABLE dbo.EmployeeWages ALTER COLUMN Title NVARCHAR(200) NOT NULL;');
END;

-- 2. Drop the old date index first: SQL Server refuses to ALTER a column an
--    index depends on (error 5074), and step 3 tightens both date columns to
--    NOT NULL. Recreated as IX_EmployeeWages_Tenure at the end.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'IX_EmployeeWages_Dates'
)
BEGIN
    DROP INDEX IX_EmployeeWages_Dates ON dbo.EmployeeWages;
END;

-- 3. A tenure is mandatory now — legacy rows could have NULL dates. Anything
--    without a range can't participate in date locking, so fall back to the
--    row's own creation date rather than leaving it unlockable.
UPDATE dbo.EmployeeWages
SET FromDate = COALESCE(FromDate, CAST(CreatedAt AS DATE)),
    ToDate   = COALESCE(ToDate,   CAST(CreatedAt AS DATE))
WHERE FromDate IS NULL OR ToDate IS NULL;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages')
      AND name = 'FromDate' AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.EmployeeWages ALTER COLUMN FromDate DATE NOT NULL;
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages')
      AND name = 'ToDate' AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.EmployeeWages ALTER COLUMN ToDate DATE NOT NULL;
END;

-- 4. Drop the dead EmployeeCode header column (POST always wrote '') and its
--    index. A wage header spans every employee in the tenure.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'IX_EmployeeWages_EmployeeCode'
)
BEGIN
    DROP INDEX IX_EmployeeWages_EmployeeCode ON dbo.EmployeeWages;
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'EmployeeCode'
)
BEGIN
    -- A column can't be dropped while a default constraint is bound to it.
    DECLARE @df NVARCHAR(200) = (
        SELECT dc.name FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.EmployeeWages') AND c.name = 'EmployeeCode'
    );
    IF @df IS NOT NULL
        EXEC('ALTER TABLE dbo.EmployeeWages DROP CONSTRAINT ' + @df);

    ALTER TABLE dbo.EmployeeWages DROP COLUMN EmployeeCode;
END;

-- 5. Drop IsWageCalculated — superseded by tenure locking. QrCode_Coupon.WageId
--    stays: it records which wage paid a coupon, and DELETE /api/wages uses it
--    to unwind a batch.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IX_QrCode_Coupon_IsWageCalculated'
)
BEGIN
    DROP INDEX IX_QrCode_Coupon_IsWageCalculated ON dbo.QrCode_Coupon;
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'IsWageCalculated'
)
BEGIN
    DECLARE @dfw NVARCHAR(200) = (
        SELECT dc.name FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.QrCode_Coupon') AND c.name = 'IsWageCalculated'
    );
    IF @dfw IS NOT NULL
        EXEC('ALTER TABLE dbo.QrCode_Coupon DROP CONSTRAINT ' + @dfw);

    ALTER TABLE dbo.QrCode_Coupon DROP COLUMN IsWageCalculated;
END;

-- Replaces the dropped IX_EmployeeWages_Dates, same columns plus Title.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'IX_EmployeeWages_Tenure'
)
BEGIN
    EXEC('CREATE INDEX IX_EmployeeWages_Tenure ON dbo.EmployeeWages(FromDate, ToDate) INCLUDE (Title);');
END;
