import { applyChangeSet, type ChangeFileState } from '@idle/core';
import type {
  ChangeSet,
  ChangeSetApplyResult as ContractChangeSetApplyResult,
  ChangeSetValidationError,
  ChangeSetVerificationError as ContractChangeSetVerificationError,
} from '@idle/contracts';
import type { FileService } from './FileService.js';
import type { ProjectService } from './ProjectService.js';

export interface ChangeSetApplyResult extends ContractChangeSetApplyResult {}

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

export interface ChangeSetReviewResult {
  id: string;
  valid: boolean;
  errors: ChangeSetValidationError[];
  preview: ChangeSetPreviewResult | null;
}

export class ChangeSetVerificationError extends Error {
  readonly errors: ContractChangeSetVerificationError[];

  constructor(errors: ContractChangeSetVerificationError[]) {
    super(`Change Set verification failed: ${errors.map((error) => error.path).join(', ')}`);
    this.name = 'ChangeSetVerificationError';
    this.errors = errors;
  }
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

  private buildPreview(changeSet: ChangeSet, states: Map<string, ChangeFileState>, result: ReturnType<typeof applyChangeSet>): ChangeSetPreviewResult {
    const changesByPath = new Map(result.changes.map((change) => [change.path, change]));
    return {
      id: changeSet.id,
      files: changeSet.changes.map((change) => {
        const current = states.get(change.path)?.content ?? null;
        const next = changesByPath.get(change.path)?.content ?? null;
        return {
          path: change.path,
          operation: change.operation,
          oldContent: change.operation === 'create' ? null : current,
          newContent: next,
          additions: Math.max(0, lineCount(next) - lineCount(current)),
          deletions: Math.max(0, lineCount(current) - lineCount(next)),
        };
      }),
    };
  }

  async review(projectId: string, changeSet: ChangeSet): Promise<ChangeSetReviewResult> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const states = await this.readStates(projectId, changeSet);
    try {
      const result = applyChangeSet(changeSet, states);
      return { id: changeSet.id, valid: true, errors: [], preview: this.buildPreview(changeSet, states, result) };
    } catch (error) {
      const errors = (error as { errors?: ChangeSetValidationError[] }).errors ?? [{
        path: '',
        code: 'BASE_MISMATCH' as const,
        message: error instanceof Error ? error.message : String(error),
      }];
      return { id: changeSet.id, valid: false, errors, preview: null };
    }
  }

  async preview(projectId: string, changeSet: ChangeSet): Promise<ChangeSetPreviewResult> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const states = await this.readStates(projectId, changeSet);
    const result = applyChangeSet(changeSet, states);
    return this.buildPreview(changeSet, states, result);
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

    const verificationErrors: ContractChangeSetVerificationError[] = [];
    const verifiedFiles: string[] = [];
    for (const change of result.changes) {
      const state = await this.files.readState(projectId, change.path);
      const expectedExists = change.content !== null;
      const matches = state.exists === expectedExists && (!expectedExists || state.content === change.content);
      if (!matches) {
        verificationErrors.push({
          path: change.path,
          code: 'VERIFY_MISMATCH',
          message: expectedExists
            ? 'The applied file content does not match the planned result.'
            : 'The applied file still exists after a planned delete.',
        });
      } else {
        verifiedFiles.push(change.path);
      }
    }

    if (verificationErrors.length > 0) throw new ChangeSetVerificationError(verificationErrors);

    return {
      id: changeSet.id,
      changedFiles: result.changes.map((change) => change.path),
      verifiedFiles,
    };
  }
}
