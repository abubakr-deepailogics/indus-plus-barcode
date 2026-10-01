-- Isolated ADD migration: later Department references live in 036 because
-- SQL Server validates a whole migration batch before executing it.
IF COL_LENGTH('dbo.EmployeeWages', 'Department') IS NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.EmployeeWages ADD Department NVARCHAR(50) NULL;');
END;
