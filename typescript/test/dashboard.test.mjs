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
  archived_at: null,
  created_at: "2026-09-02T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
  can_edit: true,
  can_manage: false,
  allowed_actions: ["get_draft", "patch_document", "put_operation"],
};

function response(body, status = 200) {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function draft(hash = "sha256:one", draftVersion = 1) {
  return {
    data: {
      dashboard: summary,
      editor_url: "https://app.test/dashboards/dashboard-1/edit",
      revision: 1,
      revision_id: "revision-1",
      document,
      content_hash: hash,
      draft_version: draftVersion,
      operations: [],
    },
    meta: { api_version: "v1" },
  };
}

test("dashboard builder carries and advances the draft hash and version", async (t) => {
  const calls = [];
  const replies = [
    response(draft()),
    response({
      data: {
        dashboard_id: "dashboard-1",
        content_hash: "sha256:one",
        draft_version: 2,
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
        draft_version: 3,
      },
      meta: { api_version: "v1" },
    }),
    response({
      data: {
        dashboard_id: "dashboard-1",
        content_hash: "sha256:two",
        draft_version: 4,
        removed: operation.key,
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
  assert.equal(dashboard.draftVersion, 1);
  assert.equal(dashboard.editorUrl, "https://app.test/dashboards/dashboard-1/edit");

  const { key, ...putBody } = operation;
  await dashboard.operations.put(key, putBody);
  assert.equal(calls[1].init.headers["If-Match"], "sha256:one");
  assert.equal(calls[1].init.headers["If-Draft-Version"], "1");
  assert.equal(dashboard.operationList[0].key, key);
  assert.equal(dashboard.draftVersion, 2);

  await dashboard.patchDocument([
    { op: "replace", path: "/theme", value: "dark" },
  ]);
  assert.equal(calls[2].init.headers["If-Match"], "sha256:one");
  assert.equal(calls[2].init.headers["If-Draft-Version"], "2");
  assert.equal(dashboard.contentHash, "sha256:two");
  assert.equal(dashboard.draftVersion, 3);

  await dashboard.operations.remove(key);
  assert.equal(calls[3].init.method, "DELETE");
  assert.equal(calls[3].init.headers["If-Match"], "sha256:two");
  assert.equal(calls[3].init.headers["If-Draft-Version"], "3");
  assert.equal(dashboard.operationList.length, 0);
  assert.equal(dashboard.draftVersion, 4);
});

test("API keys author drafts only: no publish, share or lifecycle methods", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response(draft()));
  const gluon = new GluonDB({ apiKey: "gluon_test", baseUrl: "https://api.test" });
  const dashboard = await gluon.dashboards.getDraft("dashboard-1");
  for (const method of ["publish", "share", "archive", "restore", "delete"]) {
    assert.equal(dashboard[method], undefined);
    assert.equal(gluon.dashboards[method], undefined);
  }
});

test("lists dashboards, optionally for one project", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(String(url));
    return response({ data: { dashboards: [summary] }, meta: { api_version: "v1" } });
  });
  const gluon = new GluonDB({ apiKey: "gluon_test", baseUrl: "https://api.test" });
  assert.deepEqual(await gluon.dashboards.list(), [summary]);
  await gluon.dashboards.list("project 1");
  assert.deepEqual(calls, [
    "https://api.test/v1/dashboards",
    "https://api.test/v1/dashboards?project_id=project%201",
  ]);
});

test("a stale draft version surfaces the current version without retrying", async (t) => {
  const replies = [
    response(draft()),
    response(
      {
        error: {
          code: "DRAFT_CONFLICT",
          message: "Draft changed; reload and review before retrying",
          current_draft_version: 5,
        },
      },
      412,
    ),
  ];
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return replies.shift();
  });
  const gluon = new GluonDB({ apiKey: "gluon_test", baseUrl: "https://api.test" });
  const dashboard = await gluon.dashboards.getDraft("dashboard-1");
  await assert.rejects(
    () => dashboard.patchDocument([{ op: "replace", path: "/theme", value: "dark" }]),
    (error) => {
      assert.ok(error instanceof DashboardConflictError);
      assert.equal(error.status, 412);
      assert.equal(error.currentDraftVersion, 5);
      assert.equal(error.currentHash, undefined);
      return true;
    },
  );
  assert.equal(calls, 2);
  assert.equal(dashboard.draftVersion, 1);
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
