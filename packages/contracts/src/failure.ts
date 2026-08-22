import type { ChangeSet } from './changes.js';
import type { TaskId } from './agent.js';

export interface RepairAttemptSummary {
  attempt: number;
  changeSetId?: string;
  status: 'proposed' | 'reviewed' | 'applied' | 'failed' | 'completed';
  summary?: string;
}

export interface FailureContext {
  taskId: TaskId;
  attempt: number;
  checkId: string;
  exitCode?: number;
  stdoutExcerpt: string;
  stderrExcerpt: string;
  affectedPaths: string[];
  changeSetId?: string;
  previousAttempts: RepairAttemptSummary[];
}

export type RepairOutcome =
  | { kind: 'changeset'; changeset: ChangeSet }
  | { kind: 'no_repair_proposal'; reason: string };
