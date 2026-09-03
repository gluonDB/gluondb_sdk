import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractRoot = resolve(repositoryRoot, "contracts/dashboard-v1");
const lock = JSON.parse(
  await readFile(resolve(contractRoot, "contract.lock.json"), "utf8"),
);

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function filesBelow(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function fixtureHash() {
  const hash = createHash("sha256");
  for (const path of await filesBelow(resolve(contractRoot, "fixtures"))) {
    hash.update(relative(contractRoot, path));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const actual = {
  document_schema_sha256: await sha256(
    resolve(contractRoot, "document.schema.json"),
  ),
  operation_schema_sha256: await sha256(
    resolve(contractRoot, "operation.schema.json"),
  ),
  fixtures_sha256: await fixtureHash(),
};

const stale = Object.entries(actual).filter(([key, value]) => lock[key] !== value);
if (stale.length > 0) {
  console.error("Dashboard contract snapshot does not match contract.lock.json:");
  for (const [key, value] of stale) {
    console.error(`${key}: expected=${lock[key]} actual=${value}`);
  }
  process.exitCode = 1;
}
