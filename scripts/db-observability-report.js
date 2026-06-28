require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DB,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

async function runQuery(label, sql, params = []) {
  const result = await pool.query(sql, params);
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result.rows, null, 2));
}

async function main() {
  await runQuery(
    "pg_stat_statements extension",
    `
      SELECT extname
      FROM pg_extension
      WHERE extname = 'pg_stat_statements'
    `
  );

  await runQuery(
    "hot table indexes",
    `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY tablename, indexname
    `,
    [[
      "course",
      "chapter",
      "module",
      "takes",
      "bundle_course",
      "progress",
      "prebooking",
    ]]
  );

  await runQuery(
    "table scan stats",
    `
      SELECT
        relname AS table_name,
        seq_scan,
        seq_tup_read,
        idx_scan,
        n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND relname = ANY($1::text[])
      ORDER BY seq_scan DESC, idx_scan DESC
    `,
    [[
      "course",
      "chapter",
      "module",
      "takes",
      "bundle_course",
      "progress",
      "prebooking",
    ]]
  );

  await runQuery(
    "index usage stats",
    `
      SELECT
        relname AS table_name,
        indexrelname AS index_name,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND relname = ANY($1::text[])
      ORDER BY idx_scan DESC, relname, indexrelname
      LIMIT 50
    `,
    [[
      "course",
      "chapter",
      "module",
      "takes",
      "bundle_course",
      "progress",
      "prebooking",
    ]]
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
