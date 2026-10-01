UPDATE dbo.EmployeeWages SET Department = 'sewing' WHERE Department IS NULL;

ALTER TABLE dbo.EmployeeWages ALTER COLUMN Department NVARCHAR(50) NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'DF_EmployeeWages_Department')
BEGIN
  ALTER TABLE dbo.EmployeeWages ADD CONSTRAINT DF_EmployeeWages_Department DEFAULT 'sewing' FOR Department;
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'CK_EmployeeWages_Department')
BEGIN
  ALTER TABLE dbo.EmployeeWages ADD CONSTRAINT CK_EmployeeWages_Department
    CHECK (Department IN ('cutting', 'sewing', 'washing', 'finishing', 'gdp'));
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.EmployeeWages') AND name = 'IX_EmployeeWages_Department_Tenure')
BEGIN
  CREATE INDEX IX_EmployeeWages_Department_Tenure
    ON dbo.EmployeeWages (Department, FromDate, ToDate) INCLUDE (Title);
END;
