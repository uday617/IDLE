import type { ChangeSet, FailureContext, RepairOutcome } from '@idle/contracts';

export const REPAIR_MAX_ATTEMPTS = 3 as const;

export type RepairStatus = 'verifying' | 'repair_pending' | 'review' | 'completed' | 'failed';

export interface RepairState {
  taskId: string;
  status: RepairStatus;
  repairAttempts: number;
  latestFailure?: FailureContext;
  latestChangeSetId?: string;
}

export type RepairDecision =
  | { kind: 'request_repair'; state: RepairState; failure: FailureContext }
  | { kind: 'await_review'; state: RepairState; changeSetId: string; changeSet: ChangeSet }
  | { kind: 'completed'; state: RepairState }
  | { kind: 'failed'; state: RepairState; reason: string };

export class RepairLoop {
  static readonly MAX_REPAIR_ATTEMPTS = REPAIR_MAX_ATTEMPTS;

  start(taskId: string): RepairState {
    return { taskId, status: 'verifying', repairAttempts: 0 };
  }

  onVerificationFailure(state: RepairState, failure: FailureContext): RepairDecision {
    if (state.status === 'completed' || state.status === 'failed') {
      return { kind: 'failed', state, reason: `repair loop is terminal: ${state.status}` };
    }

    if (state.repairAttempts >= REPAIR_MAX_ATTEMPTS) {
      const failed = { ...state, status: 'failed' as const, latestFailure: failure };
      return { kind: 'failed', state: failed, reason: 'repair attempt limit reached' };
    }

    const pending = {
      ...state,
      status: 'repair_pending' as const,
      repairAttempts: state.repairAttempts + 1,
      latestFailure: failure,
    };
    return { kind: 'request_repair', state: pending, failure };
  }

  onRepairProposal(state: RepairState, outcome: RepairOutcome): RepairDecision {
    if (outcome.kind === 'no_repair_proposal') {
      const failed = { ...state, status: 'failed' as const };
      return { kind: 'failed', state: failed, reason: outcome.reason };
    }

    const reviewed = {
      ...state,
      status: 'review' as const,
      latestChangeSetId: outcome.changeset.id,
    };
    return {
      kind: 'await_review',
      state: reviewed,
      changeSetId: outcome.changeset.id,
      changeSet: outcome.changeset,
    };
  }

  onVerificationSuccess(state: RepairState): RepairDecision {
    const completed = { ...state, status: 'completed' as const };
    return { kind: 'completed', state: completed };
  }
}
