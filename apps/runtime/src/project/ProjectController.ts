import type { ChangeSet } from '@idle/contracts';
import type { Project, ProjectService } from './ProjectService.js';
import type { FileContent, FileEntry, FileService } from './FileService.js';
import type { ChangeSetApplyResult, ChangeSetPreviewResult, ChangeSetReviewResult, ChangeSetService } from './ChangeSetService.js';
import { GitService, type GitDiff, type GitStatus } from './GitService.js';
import { TerminalService, type TerminalResult } from './TerminalService.js';

export type ProjectCommand =
  | { type: 'project.open'; path: string }
  | { type: 'project.get'; projectId: string }
  | { type: 'project.close'; projectId: string }
  | { type: 'file.list'; projectId: string; path: string }
  | { type: 'file.read'; projectId: string; path: string }
  | { type: 'file.write'; projectId: string; path: string; content: string }
  | { type: 'changeset.review'; projectId: string; changeSet: ChangeSet }
  | { type: 'changeset.preview'; projectId: string; changeSet: ChangeSet }
  | { type: 'changeset.apply'; projectId: string; changeSet: ChangeSet }
  | { type: 'git.status'; projectId: string }
  | { type: 'git.diff'; projectId: string }
  | { type: 'terminal.run'; projectId: string; command: string };

export type ProjectCommandResult =
  | Project
  | FileEntry[]
  | FileContent
  | ChangeSetReviewResult
  | ChangeSetPreviewResult
  | ChangeSetApplyResult
  | GitStatus
  | GitDiff
  | TerminalResult
  | null
  | { ok: true };

export class ProjectController {
  private readonly git: GitService;
  private readonly terminal: TerminalService;

  constructor(
    private readonly projects: ProjectService,
    private readonly files: FileService,
    private readonly changeSets: ChangeSetService,
  ) {
    this.git = new GitService(projects);
    this.terminal = new TerminalService(projects);
  }

  async handle(command: ProjectCommand): Promise<ProjectCommandResult> {
    switch (command.type) {
      case 'project.open': return this.projects.open(command.path);
      case 'project.get': return this.projects.get(command.projectId);
      case 'project.close': await this.projects.close(command.projectId); return { ok: true };
      case 'file.list': return this.files.list(command.projectId, command.path);
      case 'file.read': return this.files.read(command.projectId, command.path);
      case 'file.write': await this.files.write(command.projectId, command.path, command.content); return { ok: true };
      case 'changeset.review': return this.changeSets.review(command.projectId, command.changeSet);
      case 'changeset.preview': return this.changeSets.preview(command.projectId, command.changeSet);
      case 'changeset.apply': return this.changeSets.apply(command.projectId, command.changeSet);
      case 'git.status': return this.git.status(command.projectId);
      case 'git.diff': return this.git.diff(command.projectId);
      case 'terminal.run': return this.terminal.run(command.projectId, command.command);
    }
  }
}
