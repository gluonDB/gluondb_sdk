import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractRoot = resolve(packageRoot, "../contracts/dashboard-v1");
const outputRoot = resolve(packageRoot, "src/generated");
const check = process.argv.includes("--check");
const lock = JSON.parse(
  await readFile(resolve(contractRoot, "contract.lock.json"), "utf8"),
);

function normalizeForTyping(value) {
  if (Array.isArray(value)) return value.map(normalizeForTyping);
  if (value === null || typeof value !== "object") return value;

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeForTyping(item)]),
  );
  if (normalized.type === "string" && Array.isArray(normalized.allOf)) {
    // The artifact intersects two timestamp regexes. Static types only need
    // the scalar shape; public-api remains responsible for both constraints.
    delete normalized.allOf;
  }
  return normalized;
}

async function generate(schemaName, rootName, outputName, suffix = "") {
  const schema = normalizeForTyping(
    JSON.parse(await readFile(resolve(contractRoot, schemaName), "utf8")),
  );
  const compiled = await compile(schema, rootName, {
    additionalProperties: false,
    bannerComment: "",
    ignoreMinAndMaxItems: true,
  });
  const source = `// Generated from gluonDB/gluondb_front@${lock.source_revision}. Do not edit.\n\n${compiled}${suffix}`;
  const output = resolve(outputRoot, outputName);

  if (check) {
    const current = await readFile(output, "utf8").catch(() => "");
    if (current !== source) {
      console.error(`${outputName} is stale. Run npm run generate:dashboard.`);
      process.exitCode = 1;
    }
    return;
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source);
}

await generate(
  "document.schema.json",
  "DashboardDocumentV1",
  "dashboard-document.ts",
);
await generate(
  "operation.schema.json",
  "DashboardOperationDeclaration",
  "dashboard-operation.ts",
  '\nexport type DashboardOperationPutBody = Omit<DashboardOperationDeclaration, "key">;\n',
);
