import type { Project, ProjectService } from './ProjectService.js';

export type ProjectCommand =
  | { type: 'project.open'; path: string }
  | { type: 'project.get'; projectId: string }
  | { type: 'project.close'; projectId: string };

export type ProjectCommandResult = Project | null | { ok: true };

export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  async handle(command: ProjectCommand): Promise<ProjectCommandResult> {
    switch (command.type) {
      case 'project.open':
        return this.projects.open(command.path);
      case 'project.get':
        return this.projects.get(command.projectId);
      case 'project.close':
        await this.projects.close(command.projectId);
        return { ok: true };
    }
  }
}
