-- Style-bulletin header fields are app-owned metadata. Keep one independent
-- header per production department instead of sharing a Work Order record.
IF COL_LENGTH('dbo.Order_StyleBulletin_Header', 'Department') IS NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.Order_StyleBulletin_Header ADD Department NVARCHAR(50) NULL;');
END;

EXEC(N'
  UPDATE dbo.Order_StyleBulletin_Header
  SET Department = ''sewing''
  WHERE Department IS NULL;
');

EXEC(N'
  ALTER TABLE dbo.Order_StyleBulletin_Header
    ALTER COLUMN Department NVARCHAR(50) NOT NULL;
');

IF NOT EXISTS (
  SELECT 1 FROM sys.default_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.Order_StyleBulletin_Header')
    AND name = 'DF_Order_StyleBulletin_Header_Department'
)
BEGIN
  EXEC(N'
    ALTER TABLE dbo.Order_StyleBulletin_Header
      ADD CONSTRAINT DF_Order_StyleBulletin_Header_Department
      DEFAULT ''sewing'' FOR Department;
  ');
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.Order_StyleBulletin_Header')
    AND name = 'CK_Order_StyleBulletin_Header_Department'
)
BEGIN
  EXEC(N'
    ALTER TABLE dbo.Order_StyleBulletin_Header
      ADD CONSTRAINT CK_Order_StyleBulletin_Header_Department
      CHECK (Department IN (''cutting'', ''sewing'', ''washing'', ''finishing''));
  ');
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.Order_StyleBulletin_Header')
    AND name = 'UX_Order_StyleBulletin_Header_Department_WorkOrder'
)
BEGIN
  EXEC(N'
    CREATE UNIQUE INDEX UX_Order_StyleBulletin_Header_Department_WorkOrder
      ON dbo.Order_StyleBulletin_Header (Department, Work_Order);
  ');
END;
