-- Preserve the per-piece incentive used to calculate each frozen wage row.
IF COL_LENGTH('dbo.EmployeeWageRows', 'Incentive') IS NULL
BEGIN
  ALTER TABLE dbo.EmployeeWageRows ADD Incentive DECIMAL(18,4) NOT NULL
    CONSTRAINT DF_EmployeeWageRows_Incentive DEFAULT 0;
END;
