-- Migration 061: Retire dbo.CutPlanningFabricReceived (created by 060).
-- The print's GROUP table is fully calculated from cut-planning rows, so
-- fabric received is no longer entered and nothing reads this table.
-- Dropped only while empty, so no entered data can be lost.
IF OBJECT_ID('dbo.CutPlanningFabricReceived', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.CutPlanningFabricReceived)
  DROP TABLE dbo.CutPlanningFabricReceived;
