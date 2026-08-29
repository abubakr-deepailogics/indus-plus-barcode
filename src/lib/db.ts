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
    pools[db] = sql.connect(connectionString);
  }
  return pools[db];
}

export { sql };
