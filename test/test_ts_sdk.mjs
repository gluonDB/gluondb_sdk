/**
 * Smoke tests for the GluonDB TypeScript SDK against the live public API.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

const { GluonDB, GluonAPIError } = await import(
  resolve(__dirname, "..", "typescript", "dist", "index.js")
);

const API_KEY = process.env.GLUONDB_KEY;
const BASE_URL =
  process.env.GLUONDB_BASE_URL ||
  "https://api.gluondb.com";

console.log("=".repeat(60));
console.log("GluonDB TypeScript SDK - Smoke Tests (bound datasource API)");
console.log(`  Base URL: ${BASE_URL}`);
console.log(`  API Key:  ${API_KEY.slice(0, 14)}...`);
console.log("=".repeat(60));

const gluon = new GluonDB({ apiKey: API_KEY, baseUrl: BASE_URL });

// [1] List projects
console.log("\n[1] List projects");
const projectsRes = await gluon.projects.list();
const projects = projectsRes.data;
console.log(`  Projects (${projects.length}):`);
for (const p of projects) console.log(`    - ${p.name} (${p.id})`);
console.assert(projects.length >= 1, "Expected at least 1 project");
console.log("  PASSED\n");

// [2] List datasources
const projectId = projects[0].id;
console.log("[2] List datasources");
const dsRes = await gluon.datasources.list(projectId);
const datasources = dsRes.data;
console.log(`  Datasources (${datasources.length}):`);
for (const ds of datasources)
  console.log(`    - ${ds.name} [${ds.db_type}] (${ds.id})`);
console.log("  PASSED\n");

// [3] Bound datasource query
if (datasources.length > 0) {
  const dsId = datasources[0].id;
  console.log("[3] Bound datasource query");
  const pg = gluon.datasource(dsId);
  const result = await pg.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5"
  );
  console.log(`  Columns: ${result.data.columns.map((c) => c.name).join(", ")}`);
  console.log(`  Rows: ${JSON.stringify(result.data.rows.slice(0, 3))}`);
  console.log(`  row_count=${result.data.row_count}, exec_ms=${result.meta.execution_time_ms}`);
  console.log("  PASSED\n");

  // [4] Bound by name
  console.log("[4] Bound datasource by name");
  const pgByName = gluon.datasource({
    projectId,
    name: datasources[0].name,
  });
  const r2 = await pgByName.query("SELECT 1 AS n");
  console.log(`  Result: ${JSON.stringify(r2.data.rows)}`);
  console.assert(r2.data.row_count >= 1);
  console.log("  PASSED\n");
} else {
  console.log("[3] SKIPPED - no datasources\n");
  console.log("[4] SKIPPED - no datasources\n");
}

// [5] Bad API key
console.log("[5] Bad API key rejection");
const bad = new GluonDB({
  apiKey: "gluon_invalid_key_000000000000000000",
  baseUrl: BASE_URL,
});
try {
  await bad.projects.list();
  console.assert(false, "Should have thrown");
} catch (e) {
  if (e instanceof GluonAPIError) {
    console.log(`  Correctly rejected: status=${e.status}, code=${e.code}`);
    console.assert(e.status === 401);
  } else {
    throw e;
  }
}
console.log("  PASSED\n");

console.log("=".repeat(60));
console.log("All tests passed!");
console.log("=".repeat(60));
