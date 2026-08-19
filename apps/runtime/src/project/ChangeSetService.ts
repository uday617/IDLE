import { applyChangeSet, type ChangeFileState } from '@idle/core';
import type { ChangeSet } from '@idle/contracts';
import type { FileService } from './FileService.js';
import type { ProjectService } from './ProjectService.js';

export interface ChangeSetApplyResult {
  id: string;
  changedFiles: string[];
}

export class ChangeSetService {
  constructor(
    private readonly projects: ProjectService,
    private readonly files: FileService,
  ) {}

  async apply(projectId: string, changeSet: ChangeSet): Promise<ChangeSetApplyResult> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const states = new Map<string, ChangeFileState>();
    for (const change of changeSet.changes) {
      if (states.has(change.path)) continue;
      states.set(change.path, await this.files.readState(projectId, change.path));
    }

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
