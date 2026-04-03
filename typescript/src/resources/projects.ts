import type { GluonClient } from "../client.js";
import type { ApiResponse, Project } from "../types.js";

export class ProjectsResource {
  constructor(private client: GluonClient) {}

  async list(): Promise<ApiResponse<Project[]>> {
    return this.client.request<ApiResponse<Project[]>>("/projects");
  }
}
