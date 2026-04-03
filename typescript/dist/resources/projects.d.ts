import type { GluonClient } from "../client.js";
import type { ApiResponse, Project } from "../types.js";
export declare class ProjectsResource {
    private client;
    constructor(client: GluonClient);
    list(): Promise<ApiResponse<Project[]>>;
}
//# sourceMappingURL=projects.d.ts.map