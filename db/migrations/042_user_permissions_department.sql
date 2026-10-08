-- Make page/action grants department-specific. Existing grants pre-date
-- multi-department management, so they retain their current Sewing meaning.
IF COL_LENGTH('dbo.UserPermissions', 'Department') IS NULL
BEGIN
  ALTER TABLE dbo.UserPermissions ADD Department NVARCHAR(20) NULL;
END;

EXEC(N'UPDATE dbo.UserPermissions SET Department = ''sewing'' WHERE Department IS NULL;');

EXEC(N'ALTER TABLE dbo.UserPermissions ALTER COLUMN Department NVARCHAR(20) NOT NULL;');

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserPermissions_User_Page_Op')
BEGIN
  ALTER TABLE dbo.UserPermissions DROP CONSTRAINT UQ_UserPermissions_User_Page_Op;
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_UserPermissions_Department')
BEGIN
  EXEC(N'ALTER TABLE dbo.UserPermissions ADD CONSTRAINT CK_UserPermissions_Department
    CHECK (Department IN (''sewing'', ''washing'', ''finishing''));');
END;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserPermissions_User_Department_Page_Op')
BEGIN
  EXEC(N'ALTER TABLE dbo.UserPermissions ADD CONSTRAINT UQ_UserPermissions_User_Department_Page_Op
    UNIQUE (UserId, Department, PageKey, Operation);');
END;
