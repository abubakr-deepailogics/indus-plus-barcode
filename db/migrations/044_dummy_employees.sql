IF OBJECT_ID('dbo.DummyEmployee', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.DummyEmployee (
      Id            INT            IDENTITY (1, 1) NOT NULL PRIMARY KEY,
      EmployeeCode  NVARCHAR (30)  NOT NULL UNIQUE,
      EmployeeName  NVARCHAR (150) NOT NULL,
      Department    NVARCHAR (50)  NOT NULL,
      OperationCode NVARCHAR (50)  NOT NULL,
      OperationName NVARCHAR (200) NULL,
      IsActive      BIT            CONSTRAINT DF_DummyEmployee_IsActive DEFAULT 1 NOT NULL,
      CreatedAt     DATETIME2      CONSTRAINT DF_DummyEmployee_CreatedAt DEFAULT SYSUTCDATETIME() NOT NULL,
      CreatedBy     NVARCHAR (150) NULL
    );
    CREATE INDEX IX_DummyEmployee_Active_Operation
      ON dbo.DummyEmployee(IsActive, OperationCode);
  END