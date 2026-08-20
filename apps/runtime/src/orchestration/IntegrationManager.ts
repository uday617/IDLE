import type { WorktreeManager, MergeResult } from '../git/WorktreeManager.js';

export interface IntegrationVerification {
  verify(taskId: string): Promise<boolean>;
}

export interface IntegrationRequest {
  worktreeId: string;
  target: string;
}

export interface IntegrationResult {
  taskId: string;
  integrated: boolean;
  target: string;
  conflicts: string[];
  verificationPassed: boolean;
}

/** Coordinates isolated worktree merges and requires verification before success. */
export class IntegrationManager {
  constructor(
    private readonly worktrees: Pick<WorktreeManager, 'merge'>,
    private readonly verifier: IntegrationVerification,
    private readonly requests: Map<string, IntegrationRequest> = new Map(),
  ) {}

  register(taskId: string, request: IntegrationRequest): void {
    this.requests.set(taskId, request);
  }

  async integrate(taskId: string): Promise<IntegrationResult> {
    const request = this.requests.get(taskId);
    if (!request) throw new Error(`Integration request not found: ${taskId}`);

    const merge: MergeResult = await this.worktrees.merge(request.worktreeId, request.target);
    if (!merge.merged) {
      return {
        taskId,
        integrated: false,
        target: merge.target,
        conflicts: merge.conflicts,
        verificationPassed: false,
      };
    }

    const verificationPassed = await this.verifier.verify(taskId);
    if (!verificationPassed) {
      return {
        taskId,
        integrated: false,
        target: merge.target,
        conflicts: [],
        verificationPassed: false,
      };
    }

    this.requests.delete(taskId);
    return {
      taskId,
      integrated: true,
      target: merge.target,
      conflicts: [],
      verificationPassed: true,
    };
  }
}
