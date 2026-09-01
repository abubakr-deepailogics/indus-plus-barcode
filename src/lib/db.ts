import sql from "mssql";

// Single source of truth for which DB backs which data:
// - indusPlus: cut report, style bulletin
// - pitSystem: any data pushed/written (coupons, scans, etc.)
// - hrms: worker info
const CONNECTION_STRINGS = {
  indusPlus: process.env.MSSQL_INDUS_PLUS_CONNECTION_STRING,
  pitSystem: process.env.MSSQL_PIT_SYSTEM_CONNECTION_STRING,
  hrms: process.env.MSSQL_HRMS_CONNECTION_STRING,
} as const;

export type Database = keyof typeof CONNECTION_STRINGS;

const pools: Partial<Record<Database, Promise<sql.ConnectionPool>>> = {};

export async function getPool(db: Database) {
  const connectionString = CONNECTION_STRINGS[db];
  if (!connectionString) {
    throw new Error(`Missing connection string env var for database "${db}"`);
  }
  if (!pools[db]) {
    // `new sql.ConnectionPool(...)` — NOT the package's shared `sql.connect()`.
    // That global helper (mssql/lib/global-connection.js) caches a single
    // module-level pool and silently ignores the config on every call after
    // the first: with 3 different servers here, whichever database connects
    // first would silently become the target for every other database's
    // queries too, surfacing as "Invalid object name" for perfectly valid
    // objects (they're being looked up on the wrong server entirely). Each
    // key needs its own real, independent pool instance.
    const pool = new sql.ConnectionPool(connectionString);
    pools[db] = pool.connect().catch((err) => {
      // Don't cache a permanently-broken pool — a transient connect failure
      // (network blip, DB briefly unreachable) would otherwise wedge this
      // database for the rest of the process's life until restart.
      delete pools[db];
      throw err;
    });
  }
  return pools[db];
}

export { sql };

// indusPlus's real (production) SaleOrderPOCutDetailViewV1 exposes its
// business columns with spaces/symbols (e.g. "Work Order #") and carries no
// RowId, unlike the clean snake_case shape the rest of the app expects.
// These names are aliases only — WHERE/ORDER BY clauses in the *same*
// SELECT can't see them yet, so filter against the raw bracketed names
// (see cutDetailByFilter below for the common filtered-lookup case).
export const CUT_DETAIL_VIEW = "dbo.SaleOrderPOCutDetailViewV1";
export const CUT_DETAIL_COLUMNS_SQL = `
  [Sale Order No] AS Sale_Order_No,
  [Customer Name] AS Customer_Name,
  [Work Order #] AS Work_Order,
  [Order Qty After % Add] AS Order_Qty_After_Add,
  Inseam,
  Size,
  Color,
  [Fabric Code(Main Body)] AS Fabric_Code_Main_Body,
  Wash,
  [Cut #] AS Cut,
  [Bundle Id] AS Bundle_Id,
  [Bundle Qty] AS Bundle_Qty,
  Shade,
  Shrinkage
`;

// Builds a query for a *filtered* cut-detail lookup with a synthesized
// RowId (the view has none). `whereSql` must use the raw bracketed column
// names (e.g. "[Work Order #] = @wo") and is applied in an inner CTE,
// **before** RowId is computed in the outer SELECT — do not merge these
// into one SELECT. ROW_NUMBER() is a blocking operator: once it's in the
// same step as the filter, SQL Server can't push the predicate down into
// the view anymore and instead sorts/numbers the entire (large) view before
// filtering, which reliably times out. Filtering first keeps the window
// function scoped to the already-small, already-filtered result.
export function cutDetailByFilter(whereSql: string, orderBy = "Cut, Bundle_Id") {
  return `
    WITH Filtered AS (
      SELECT ${CUT_DETAIL_COLUMNS_SQL}
      FROM ${CUT_DETAIL_VIEW}
      WHERE ${whereSql}
    )
    SELECT ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS RowId, *
    FROM Filtered
  `;
}

// Same normalization for indusPlus's style bulletin source. In production
// the table itself is named StyleBullettinInt (extra "t" — the real name,
// not a typo here) and its business columns are also space-separated.
export const STYLE_BULLETIN_TABLE = "dbo.StyleBullettinInt";

// Operations lookup also renamed in production: dbo.Operations -> dbo.S_OperationsCatalog.
// OperationCode/SkillLevel (the only columns this app joins on) are named
// identically in both, so no column aliasing is needed — just the table name.
export const OPERATIONS_CATALOG_TABLE = "dbo.S_OperationsCatalog";

// hrms has no dbo.Workers table — worker info is exposed as this view.
// EmployeeID/FirstName/DesignationName/ParentDepartment/DepartmentName (the
// columns this app reads) are named identically, so no aliasing is needed —
// just the table name, same as OPERATIONS_CATALOG_TABLE above. Query it only
// on the "hrms" pool (see CONNECTION_STRINGS) — hrms and pitSystem are
// different SQL Server instances, not just different databases on one
// server, so this view can never be joined in the same query as
// dbo.QrCode_Coupon/dbo.StyleBullettinInt; fetch separately and merge in JS.
export const WORKERS_VIEW = "dbo.S_EmpDataPITSView";

// Attendance/biometric-punch view, also hrms-only (see WORKERS_VIEW above).
// One row per EmployeeID per worked day, keyed by ShiftInDate/ShiftOutDate
// (a night shift can span midnight, hence checking both) — a day with no
// attendance at all simply has no row, rather than a row with a status
// flag, so "present" is existence of a matching row, not a column value.
// CheckInTime/CheckOutTime can each be individually null (a missed punch
// on one side) without meaning absent — only check EXISTS, never require
// both columns to be non-null.
export const ATTENDANCE_VIEW = "dbo.S_AttendancePITSView";

// See cutDetailByFilter above for why filtering happens before RowId is
// computed. `whereSql` must use the raw bracketed StyleBullettinInt names
// (e.g. "[Order No] = @wo").
export function styleBulletinByFilter(
  whereSql: string,
  orderBy = "Operation_Sequence",
) {
  return `
    WITH Filtered AS (
      SELECT
        [Sale order No] AS Sale_Order_No,
        [Customer Name] AS Customer_Name,
        [Order No] AS Order_No,
        sb.[Operation Code] AS Operation_Code,
        [Operation Name] AS Operation_Name,
        sb.Section,
        [Operation Sequeance] AS Operation_Sequence,
        [Machine Type] AS Machine_Type,
        TRY_CAST([Piece Rate] AS FLOAT) AS Piece_Rate,
        TRY_CAST([Smv/Sam] AS FLOAT) AS Smv_Sam,
        [First Operation Section Wise] AS First_Operation_Section_Wise,
        [Last Operation Section Wise] AS Last_Operation_Section_Wise,
        op.SkillLevel
      FROM ${STYLE_BULLETIN_TABLE} sb
      LEFT JOIN ${OPERATIONS_CATALOG_TABLE} op ON sb.[Operation Code] = op.OperationCode
      WHERE ${whereSql}
    )
    SELECT ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS RowId, *
    FROM Filtered
  `;
}
