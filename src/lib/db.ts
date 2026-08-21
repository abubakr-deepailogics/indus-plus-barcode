import sql from "mssql";

let pool: sql.ConnectionPool | null = null;
let initialized = false;

async function initializeDatabase(p: sql.ConnectionPool) {
  try {
    console.log("Initializing database schema and checking migrations...");

    // 1. Order_StyleBulletin_Header setup
    await p.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Order_StyleBulletin_Header]') AND type in (N'U'))
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
          )
      END
      ELSE
      BEGIN
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order_StyleBulletin_Header]') AND name = 'Forward_For_Approval')
          BEGIN
              ALTER TABLE [dbo].[Order_StyleBulletin_Header] ADD [Forward_For_Approval] NVARCHAR(50) NULL
          END
      END
    `);

    // 2. QrCode_Coupon column setups (EmployeeCode, ScanBy, ScannedAt, CutNo)
    await p.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'EmployeeCode'
      )
      BEGIN
        ALTER TABLE dbo.QrCode_Coupon ADD EmployeeCode NVARCHAR(100) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'ScanBy'
      )
      BEGIN
        ALTER TABLE dbo.QrCode_Coupon ADD ScanBy NVARCHAR(100) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'ScannedAt'
      )
      BEGIN
        ALTER TABLE dbo.QrCode_Coupon ADD ScannedAt DATETIME NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'CutNo'
      )
      BEGIN
        ALTER TABLE dbo.QrCode_Coupon ADD CutNo NVARCHAR(50) NULL;
      END
    `);

    console.log("Database schema initialization completed successfully.");
  } catch (error) {
    console.error("Database initialization error during pool setup:", error);
  }
}

export async function getPool() {
  if (!pool) {
    if (!process.env.MSSQL_CONNECTION_STRING) {
      throw new Error("MSSQL_CONNECTION_STRING environment variable is missing.");
    }
    pool = await sql.connect(process.env.MSSQL_CONNECTION_STRING);
  }

  if (!initialized) {
    initialized = true;
    await initializeDatabase(pool);
  }

  return pool;
}

export { sql };
