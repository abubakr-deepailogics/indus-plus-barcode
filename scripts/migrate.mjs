// Applies db/migrations/*.sql, in filename order, against MSSQL_PIT_SYSTEM_CONNECTION_STRING.
// All migrations in this repo target PIT-System (see db/migrations/010's header comment for
// why: it's the app-owned database — indusPlus/hrms are read-only ERP sources this app has no
// CREATE permission on). If a future migration needs a different database, this script and the
// migration file's header comment both need to say so explicitly.
//
// Applied filenames are tracked in dbo._SchemaMigrations so this is safe to run any time (fresh
// environment, after a DB rebuild, in CI/deploy) without re-running work that already landed.
// Per AGENTS.md, schema changes don't belong on the request hot path — this script is the place
// for them instead.
//
// Usage:
//   npm run migrate              # applies pending migrations (loads .env + .env.development)
//   npm run migrate -- --env=production   # loads .env + .env.production
//   npm run migrate -- --status  # lists applied/pending without running anything
//   npm run migrate -- --dry-run # prints which files WOULD run, without running them

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sql from "mssql";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

function parseArgs(argv) {
  const args = { status: false, dryRun: false, env: null };
  for (const arg of argv) {
    if (arg === "--status") args.status = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--env=")) args.env = arg.slice("--env=".length);
  }
  return args;
}

// Minimal .env parser matching this repo's format (`KEY = VALUE` or `KEY=VALUE`, one per line,
// `#` comments). No dependency on the `dotenv` package since it isn't installed here. Mirrors
// Next.js's own precedence loosely: base .env first, then the mode-specific file on top of it —
// but never overrides a variable already present in the real process environment.
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

function loadEnv(mode) {
  const root = path.join(__dirname, "..");
  const merged = {
    ...loadEnvFile(path.join(root, ".env")),
    ...loadEnvFile(path.join(root, `.env.${mode}`)),
  };
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

async function ensureTrackingTable(pool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '_SchemaMigrations' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo._SchemaMigrations (
        Filename  NVARCHAR(255)  NOT NULL PRIMARY KEY,
        AppliedAt DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

async function getAppliedFilenames(pool) {
  const result = await pool.request().query("SELECT Filename FROM dbo._SchemaMigrations");
  return new Set(result.recordset.map((row) => row.Filename));
}

async function applyMigration(pool, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const contents = fs.readFileSync(filePath, "utf8");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).batch(contents);
    await new sql.Request(transaction)
      .input("filename", sql.NVarChar(255), filename)
      .query("INSERT INTO dbo._SchemaMigrations (Filename) VALUES (@filename)");
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnv(args.env || process.env.NODE_ENV || "development");

  const connectionString = process.env.MSSQL_PIT_SYSTEM_CONNECTION_STRING;
  if (!connectionString) {
    console.error("Missing MSSQL_PIT_SYSTEM_CONNECTION_STRING (checked .env / .env.<mode>).");
    process.exitCode = 1;
    return;
  }

  const allFiles = listMigrationFiles();
  const pool = await sql.connect(connectionString);
  try {
    await ensureTrackingTable(pool);
    const applied = await getAppliedFilenames(pool);
    const pending = allFiles.filter((name) => !applied.has(name));

    if (args.status) {
      for (const name of allFiles) {
        console.log(`${applied.has(name) ? "[applied]" : "[pending]"} ${name}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log("Nothing to apply — all migrations already recorded.");
      return;
    }

    if (args.dryRun) {
      console.log("Pending migrations (dry run, nothing executed):");
      for (const name of pending) console.log(`  ${name}`);
      return;
    }

    for (const name of pending) {
      process.stdout.write(`Applying ${name}... `);
      try {
        await applyMigration(pool, name);
        console.log("OK");
      } catch (err) {
        console.log("FAILED");
        console.error(err instanceof Error ? err.message : err);
        process.exitCode = 1;
        return; // stop here — later migrations may depend on this one
      }
    }
    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 1;
});
