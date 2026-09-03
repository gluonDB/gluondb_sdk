import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DashboardConflictError,
  GluonDB,
  GluonAPIError,
  RevisionChangedError,
} from "../dist/index.js";

const document = JSON.parse(
  readFileSync(
    new URL("../../contracts/dashboard-v1/fixtures/valid/representative.json", import.meta.url),
    "utf8",
  ),
);
const operation = JSON.parse(
  readFileSync(
    new URL(
      "../../contracts/dashboard-v1/fixtures/operations/valid/representative.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const invalidDocument = JSON.parse(
  readFileSync(
    new URL("../../contracts/dashboard-v1/fixtures/invalid/unknown-field.json", import.meta.url),
    "utf8",
  ),
);

const summary = {
  id: "dashboard-1",
  project_id: "project-1",
  owner_user_id: "user-1",
  name: "Revenue",
  description: null,
  draft_revision_id: "revision-1",
  published_revision_id: null,
  created_at: "2026-09-02T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
};

function response(body, status = 200) {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function draft(hash = "sha256:one") {
  return {
    data: {
      dashboard: summary,
      revision: 1,
      revision_id: "revision-1",
      document,
      content_hash: hash,
      operations: [],
    },
    meta: { api_version: "v1" },
  };
}

test("dashboard builder carries and advances the server draft hash", async (t) => {
  const calls = [];
  const replies = [
    response(draft()),
    response({
      data: {
        dashboard_id: "dashboard-1",
        content_hash: "sha256:one",
        operation: { ...operation, query_hash: "sha256:query" },
      },
      meta: { api_version: "v1" },
    }),
    response({
      data: {
        dashboard_id: "dashboard-1",
        revision: 1,
        revision_id: "revision-1",
        document: { ...document, theme: "dark" },
        content_hash: "sha256:two",
      },
      meta: { api_version: "v1" },
    }),
    response({
      data: {
        dashboard_id: "dashboard-1",
        published_revision: 1,
        published_revision_id: "revision-1",
        published_content_hash: "sha256:two",
        published_at: "2026-09-02T01:00:00Z",
        next_draft_revision: 2,
        next_draft_revision_id: "revision-2",
        next_draft_hash: "sha256:three",
        reused_grant: false,
        dry_run: { executed: [], skipped: [] },
      },
      meta: { api_version: "v1" },
    }),
  ];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    return replies.shift();
  });

  const gluon = new GluonDB({
    apiKey: "gluon_test",
    baseUrl: "https://api.test",
  });
  const dashboard = await gluon.dashboards.create({
    projectId: "project-1",
    name: "Revenue",
  });
  assert.equal(dashboard.contentHash, "sha256:one");

  const { key, ...putBody } = operation;
  await dashboard.operations.put(key, putBody);
  assert.equal(calls[1].init.headers["If-Match"], "sha256:one");
  assert.equal(dashboard.operationList[0].key, key);

  await dashboard.patchDocument([
    { op: "replace", path: "/theme", value: "dark" },
  ]);
  assert.equal(calls[2].init.headers["If-Match"], "sha256:one");
  assert.equal(dashboard.contentHash, "sha256:two");

  await dashboard.publish();
  assert.equal(calls[3].init.headers["If-Match"], "sha256:two");
  assert.equal(dashboard.contentHash, "sha256:three");
  assert.equal(dashboard.revision, 2);
});

test("conflicts expose the current hash without retrying", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return response(
      {
        error: {
          code: "DRAFT_CONFLICT",
          message: "Draft changed",
          current_hash: "sha256:current",
        },
      },
      412,
    );
  });
  const gluon = new GluonDB({ apiKey: "gluon_test", baseUrl: "https://api.test" });
  await assert.rejects(
    () => gluon.dashboards.getDraft("dashboard-1"),
    (error) => {
      assert.ok(error instanceof DashboardConflictError);
      assert.equal(error.currentHash, "sha256:current");
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("revision changes expose the current published revision", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    response(
      {
        error: {
          code: "REVISION_CHANGED",
          message: "Reload",
          current_revision: 7,
        },
      },
      409,
    ),
  );
  const gluon = new GluonDB({ apiKey: "gluon_test", baseUrl: "https://api.test" });
  await assert.rejects(
    () => gluon.dashboards.getDraft("dashboard-1"),
    (error) => {
      assert.ok(error instanceof RevisionChangedError);
      assert.equal(error.currentRevision, 7);
      return true;
    },
  );
});

test("invalid canonical fixtures reach the server and preserve validation details", async (t) => {
  const calls = [];
  const replies = [
    response(draft()),
    response(
      {
        error: {
          code: "INVALID_DOCUMENT",
          message: "Patched document is not valid",
          details: [{ path: ["unexpected"], message: "Unknown field" }],
        },
      },
      422,
    ),
  ];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    return replies.shift();
  });

  const gluon = new GluonDB({ apiKey: "gluon_test", baseUrl: "https://api.test" });
  const dashboard = await gluon.dashboards.getDraft("dashboard-1");
  await assert.rejects(
    () =>
      dashboard.patchDocument([
        { op: "replace", path: "", value: invalidDocument },
      ]),
    (error) => {
      assert.ok(error instanceof GluonAPIError);
      assert.deepEqual(error.details, [
        { path: ["unexpected"], message: "Unknown field" },
      ]);
      return true;
    },
  );
  assert.equal(calls.length, 2);
  assert.deepEqual(
    JSON.parse(calls[1].init.body).patch[0].value,
    invalidDocument,
  );
});
