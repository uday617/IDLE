import type { FileService } from '../project/FileService.js';
import type { ProjectService } from '../project/ProjectService.js';
import type { TaskRunRequest } from '../tasks/TaskRunner.js';

export interface AgentExecutionResult {
  taskId: string;
  projectId: string;
  prompt: string;
  projectPath: string;
  topLevelEntries: Array<{ name: string; kind: 'file' | 'directory' }>;
  packageName?: string;
}

export class AgentExecutor {
  constructor(
    private readonly projects: ProjectService,
    private readonly files: FileService,
  ) {}

  async execute(request: TaskRunRequest): Promise<AgentExecutionResult> {
    if (!request.projectId) throw new Error('Agent task requires a project id');
    const project = await this.projects.get(request.projectId);
    if (!project) throw new Error(`Project not found: ${request.projectId}`);

    const entries = await this.files.list(request.projectId, '.');
    const packageState = await this.files.readState(request.projectId, 'package.json');
    let packageName: string | undefined;
    if (packageState.exists) {
      try {
        const parsed = JSON.parse(packageState.content) as { name?: unknown };
        if (typeof parsed.name === 'string' && parsed.name.length > 0) packageName = parsed.name;
      } catch {
        // A malformed package.json should not prevent read-only project inspection.
      }
    }

    return {
      taskId: request.id,
      projectId: request.projectId,
      prompt: request.prompt ?? '',
      projectPath: project.path,
      topLevelEntries: entries.map(({ name, kind }) => ({ name, kind })),
      ...(packageName ? { packageName } : {}),
    };
  }
}
