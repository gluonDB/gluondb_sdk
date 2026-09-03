import type {
  DashboardDocumentV1,
  DashboardOperationPutBody,
} from "../src/index.js";

const document: DashboardDocumentV1 = {
  schema_version: 1,
  theme: "system",
  parameters: {
    generated_at: {
      type: "timestamp",
      default: "2026-09-02T12:00:00Z",
    },
  },
  layout: { type: "grid", columns: 12, gap: 16 },
  blocks: [
    {
      id: "generated-at",
      type: "text",
      position: { x: 0, y: 0, w: 4, h: 1 },
      format: "plain",
      content: "Generated at",
    },
  ],
};

const operation: DashboardOperationPutBody = {
  datasource_id: "67a29b2c-2fda-4bb0-8a4a-fcbc80b4272d",
  sql: "SELECT {{generated_at}} AS generated_at",
  parameters: {
    generated_at: {
      type: "timestamp",
      default: "2026-09-02T12:00:00Z",
    },
  },
};

void document;
void operation;
