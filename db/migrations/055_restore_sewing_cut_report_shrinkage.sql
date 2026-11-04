-- Shrinkage is entered in Cut Planning and must remain part of the immutable
-- Sewing Cut Report snapshot for every generated bundle.
IF COL_LENGTH('dbo.SewingCutReport', 'Shrinkage') IS NULL
BEGIN
  ALTER TABLE dbo.SewingCutReport
    ADD Shrinkage NVARCHAR(100) NULL;
END;

-- Recover the value for existing report rows when their source Cut Planning
-- row still exists. Allocations retain the original planning Cut No., which
-- also covers shade-split report Cuts such as 5A/5B. This must be dynamic SQL
-- because SQL Server compiles a migration batch before the ALTER TABLE above.
EXEC(N'
  UPDATE report
  SET Shrinkage = source.Shrinkage
  FROM dbo.SewingCutReport AS report
  OUTER APPLY (
    SELECT TOP (1) planning.Shrinkage
    FROM dbo.BundleGenerationAllocation AS allocation
    INNER JOIN dbo.CutPlanning AS planning
      ON planning.WorkOrder = allocation.WorkOrder
      AND LOWER(LTRIM(RTRIM(planning.CutNo))) = LOWER(LTRIM(RTRIM(allocation.CutNo)))
      AND planning.IsDeleted = 0
    WHERE allocation.BundleGenerationId = report.BundleGenerationId
    ORDER BY allocation.Id
  ) AS source
  WHERE NULLIF(LTRIM(RTRIM(report.Shrinkage)), '''') IS NULL
    AND NULLIF(LTRIM(RTRIM(source.Shrinkage)), '''') IS NOT NULL;
');
