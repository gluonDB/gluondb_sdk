// ---- Configuration ----

export interface GluonDBConfig {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
}

// ---- API response envelope ----

export interface ApiMeta {
  api_version: string;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

// ---- Query ----

export interface Column {
  name: string;
  type: string;
}

export interface QueryData {
  columns: Column[];
  rows: any[][];
  row_count: number;
}

export interface QueryMeta extends ApiMeta {
  datasource_id: string;
  execution_time_ms: number;
}

export type QueryResponse = {
  data: QueryData;
  meta: QueryMeta;
};

// ---- Projects ----

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

// ---- Datasources ----

export interface Datasource {
  id: string;
  name: string;
  db_type: string;
  created_at: string;
}
