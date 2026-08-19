import type { Project, ProjectService } from './ProjectService.js';
import type { FileContent, FileEntry, FileService } from './FileService.js';

export type ProjectCommand =
  | { type: 'project.open'; path: string }
  | { type: 'project.get'; projectId: string }
  | { type: 'project.close'; projectId: string }
  | { type: 'file.list'; projectId: string; path: string }
  | { type: 'file.read'; projectId: string; path: string }
  | { type: 'file.write'; projectId: string; path: string; content: string };

export type ProjectCommandResult = Project | FileEntry[] | FileContent | null | { ok: true };

export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly files: FileService,
  ) {}

  async handle(command: ProjectCommand): Promise<ProjectCommandResult> {
    switch (command.type) {
      case 'project.open':
        return this.projects.open(command.path);
      case 'project.get':
        return this.projects.get(command.projectId);
      case 'project.close':
        await this.projects.close(command.projectId);
        return { ok: true };
      case 'file.list':
        return this.files.list(command.projectId, command.path);
      case 'file.read':
        return this.files.read(command.projectId, command.path);
      case 'file.write':
        await this.files.write(command.projectId, command.path, command.content);
        return { ok: true };
    }
  }
}
