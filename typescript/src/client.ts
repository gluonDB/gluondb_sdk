import type { ApiErrorResponse, GluonDBConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.gluondb.com";
const DEFAULT_API_VERSION = "v1";

export class GluonAPIError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "GluonAPIError";
    this.code = code;
    this.status = status;
  }
}

export class GluonClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: GluonDBConfig) {
    if (!config.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = config.apiKey;
    const version = config.apiVersion || DEFAULT_API_VERSION;
    const base = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.baseUrl = `${base}/${version}`;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      let body: ApiErrorResponse | undefined;
      try {
        body = (await res.json()) as ApiErrorResponse;
      } catch {
        // ignore parse failures
      }
      throw new GluonAPIError(
        body?.error?.code || "UNKNOWN",
        body?.error?.message || `HTTP ${res.status}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  }
}
