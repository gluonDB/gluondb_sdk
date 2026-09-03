import { readFile } from "node:fs/promises";
import { GluonDB } from "../typescript/dist/index.js";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const contractRoot = new URL("../contracts/dashboard-v1/", import.meta.url);
const document = JSON.parse(
  await readFile(new URL("fixtures/valid/representative.json", contractRoot), "utf8"),
);
const operations = JSON.parse(
  await readFile(new URL("../examples/representative-operations.json", import.meta.url), "utf8"),
);

const gluon = new GluonDB({
  apiKey: required("GLUONDB_KEY"),
  baseUrl: required("GLUONDB_BASE_URL"),
});
const dashboard = await gluon.dashboards.create({
  projectId: required("GLUONDB_PROJECT_ID"),
  name: `SDK representative ${new Date().toISOString()}`,
});

for (const { key, ...operation } of operations) {
  await dashboard.operations.put(key, {
    datasource_id: required("GLUONDB_DATASOURCE_ID"),
    ...operation,
  });
}
await dashboard.patchDocument([
  { op: "replace", path: "/parameters", value: document.parameters },
]);
for (const block of document.blocks) await dashboard.blocks.add(block);

const published = await dashboard.publish();
console.log(
  JSON.stringify(
    {
      dashboard_id: dashboard.id,
      published_revision: published.published_revision,
      next_draft_hash: dashboard.contentHash,
    },
    null,
    2,
  ),
);
