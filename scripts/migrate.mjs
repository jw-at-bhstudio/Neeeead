import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { Client } from "pg";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env.migrate", override: true, quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const migrationsDir = path.resolve(projectRoot, "supabase", "migrations");
const advisoryLockKey = 80512026091441;

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      id bigserial primary key,
      filename text not null unique,
      checksum text not null,
      executed_at timestamptz not null default now()
    );
  `);
}

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Missing DATABASE_URL. Put it in .env.migrate or export it before running npm run db:migrate."
    );
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to database.");

  try {
    await client.query(`select pg_advisory_lock(${advisoryLockKey});`);
    await ensureMigrationsTable(client);

    const files = await getMigrationFiles();
    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const filename of files) {
      const fullPath = path.join(migrationsDir, filename);
      const sql = await fs.readFile(fullPath, "utf8");
      const checksum = sha256(sql);

      const existing = await client.query(
        "select checksum from public.schema_migrations where filename = $1 limit 1",
        [filename]
      );

      if (existing.rowCount && existing.rows[0].checksum === checksum) {
        console.log(`Skip ${filename} (already applied).`);
        continue;
      }

      if (existing.rowCount && existing.rows[0].checksum !== checksum) {
        throw new Error(
          `Checksum mismatch for ${filename}. This migration was already applied with different content.`
        );
      }

      console.log(`Applying ${filename} ...`);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations(filename, checksum) values($1, $2)",
          [filename, checksum]
        );
        await client.query("commit");
        console.log(`Applied ${filename}.`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
  } finally {
    await client.query(`select pg_advisory_unlock(${advisoryLockKey});`).catch(() => {});
    await client.end();
  }
}

run()
  .then(() => {
    console.log("Migration completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:");
    console.error(error);
    process.exit(1);
  });
