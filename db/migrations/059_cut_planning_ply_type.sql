-- Migration 059: Ply type per cut-planning row ("SINGLE PLY", "DOUBLE PLY", ...).
-- Nullable with no backfill: NULL means the default ("SINGLE PLY"), which the
-- app applies when reading, so existing rows need no rewrite.
IF COL_LENGTH('dbo.CutPlanning', 'PlyType') IS NULL
  ALTER TABLE dbo.CutPlanning ADD PlyType NVARCHAR(50) NULL;
