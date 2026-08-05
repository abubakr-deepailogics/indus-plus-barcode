import sql from "mssql";

let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(process.env.MSSQL_CONNECTION_STRING!);
  }
  return pool;
}

export { sql };
