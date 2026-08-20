import { applyChangeSet, type ChangeFileState } from '@idle/core';
import type { ChangeSet } from '@idle/contracts';
import type { FileService } from './FileService.js';
import type { ProjectService } from './ProjectService.js';

export interface ChangeSetApplyResult {
  id: string;
  changedFiles: string[];
}

export interface ChangeSetPreviewFile {
  path: string;
  operation: 'modify' | 'create' | 'delete';
  oldContent: string | null;
  newContent: string | null;
  additions: number;
  deletions: number;
}

export interface ChangeSetPreviewResult {
  id: string;
  files: ChangeSetPreviewFile[];
}

function lineCount(content: string | null): number {
  if (content === null || content.length === 0) return 0;
  const lines = content.split('\n');
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

export class ChangeSetService {
  constructor(
    private readonly projects: ProjectService,
    private readonly files: FileService,
  ) {}

  private async readStates(projectId: string, changeSet: ChangeSet): Promise<Map<string, ChangeFileState>> {
    const states = new Map<string, ChangeFileState>();
    for (const change of changeSet.changes) {
      if (states.has(change.path)) continue;
      states.set(change.path, await this.files.readState(projectId, change.path));
    }
    return states;
  }

  async preview(projectId: string, changeSet: ChangeSet): Promise<ChangeSetPreviewResult> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const states = await this.readStates(projectId, changeSet);
    const result = applyChangeSet(changeSet, states);
    const changesByPath = new Map(result.changes.map((change) => [change.path, change]));

    return {
      id: changeSet.id,
      files: changeSet.changes.map((change) => {
        const current = states.get(change.path)?.content ?? null;
        const next = changesByPath.get(change.path)?.content ?? null;
        return {
          path: change.path,
          operation: change.operation,
          oldContent: current,
          newContent: next,
          additions: Math.max(0, lineCount(next) - lineCount(current)),
          deletions: Math.max(0, lineCount(current) - lineCount(next)),
        };
      }),
    };
  }

  async apply(projectId: string, changeSet: ChangeSet): Promise<ChangeSetApplyResult> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const states = await this.readStates(projectId, changeSet);
    const result = applyChangeSet(changeSet, states);
    await this.files.applyBatch(projectId, result.changes.map((change) => ({
      path: change.path,
      content: change.content,
    })));

    return {
      id: changeSet.id,
      changedFiles: result.changes.map((change) => change.path),
    };
  }
}
