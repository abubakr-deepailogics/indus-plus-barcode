-- Migration 060: Fabric received per shade group for a cut-planning work order.
-- Mirrors the "GROUP / FABRIC" input block of the Excel "SIZE DETAIL & CHECK
-- LIST": Pcs req = received / average, balance = received - fabric used by
-- marker rows whose Shade equals the group. Saved as a full replacement per
-- work order, inside the same transaction as dbo.CutPlanning.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CutPlanningFabricReceived' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.CutPlanningFabricReceived (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
    WorkOrder NVARCHAR(100) NOT NULL,
    ShadeGroup NVARCHAR(100) NOT NULL,
    ReceivedMetres DECIMAL(18,3) NOT NULL,
    InsertedAt DATETIME2 NOT NULL CONSTRAINT DF_CutPlanningFabricReceived_InsertedAt DEFAULT SYSUTCDATETIME(),
    InsertedBy NVARCHAR(100) NULL,
    CONSTRAINT UQ_CutPlanningFabricReceived_WorkOrderGroup UNIQUE (WorkOrder, ShadeGroup),
    CONSTRAINT CK_CutPlanningFabricReceived_Metres CHECK (ReceivedMetres >= 0)
  );
END;
