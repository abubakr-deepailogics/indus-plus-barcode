-- Creates dbo.Order_StyleBulletin_Header on PIT-System to store this app's
-- own bulletin header metadata (approval status, targets, SMD numbers, ...)
-- keyed by work order. This was previously created/altered inline on every
-- POST to /api/open-order (an anti-pattern per AGENTS.md) and pointed at
-- indusPlus — the real "Indus Plus" ERP database, where this app's
-- credentials have no CREATE TABLE permission (it's read-only source data).
-- This is app-written data, so it belongs on PIT-System like coupons/scans,
-- not on the ERP connection. Run this against PIT-System.
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Order_StyleBulletin_Header]') AND type = N'U')
BEGIN
  CREATE TABLE [dbo].[Order_StyleBulletin_Header] (
    [Work_Order] NVARCHAR(50) NOT NULL PRIMARY KEY,
    [Description] NVARCHAR(255) NULL,
    [Style_Description] NVARCHAR(255) NULL,
    [Style_Category] NVARCHAR(100) NULL,
    [Smd_No] NVARCHAR(50) NULL,
    [Final_Smd_No] NVARCHAR(50) NULL,
    [Target] NVARCHAR(50) NULL,
    [Target_Unit_Min] NVARCHAR(50) NULL,
    [Start_Time] NVARCHAR(50) NULL,
    [Poc_Sam] NVARCHAR(50) NULL,
    [Poc_Piece_Rate] NVARCHAR(50) NULL,
    [Head_Reqd] NVARCHAR(50) NULL,
    [App_Date] NVARCHAR(50) NULL,
    [App_By] NVARCHAR(100) NULL,
    [Status] NVARCHAR(50) NULL,
    [Forward_For_Approval] NVARCHAR(50) NULL,
    [UpdatedAt] DATETIME DEFAULT GETDATE()
  );
END
