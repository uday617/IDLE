import type { AgentId, AgentRunRecord, AgentSubtask, ChangeSet, MultiAgentConfig, TaskId } from '@idle/contracts';
import { ConflictDetector } from './ConflictDetector.js';
import { CoordinationEventEmitter } from './CoordinationEventEmitter.js';
import { CoordinationStateStore } from './CoordinationStateStore.js';
import { ChangeSetAggregator } from './ChangeSetAggregator.js';
import { TaskDecomposer } from './TaskDecomposer.js';

export interface AgentTask {
  id: TaskId;
  prompt: string;
}

export interface AgentExecutionResult {
  changeSet: ChangeSet;
  claimedPaths?: string[];
}

export type AgentSubtaskExecutor = (
  subtask: AgentSubtask,
  agentId: AgentId,
  signal: AbortSignal,
) => Promise<AgentExecutionResult>;

export interface CoordinationResult {
  status: 'completed' | 'failed' | 'cancelled' | 'conflict';
  runs: AgentRunRecord[];
  combinedChangeSet?: ChangeSet;
  conflicts: Array<{ subtaskIds: string[]; paths: string[] }>;
  failures: Array<{ subtaskId: string; error: string }>;
}

const DEFAULT_CONFIG: MultiAgentConfig = {
  defaultMaxAgents: 2,
  hardMaxAgents: 4,
};

export class MultiAgentCoordinator {
  constructor(private readonly executeSubtask: AgentSubtaskExecutor) {}

  async run(task: AgentTask, config: MultiAgentConfig = DEFAULT_CONFIG, signal: AbortSignal = new AbortController().signal): Promise<CoordinationResult> {
    const hardCap = Math.min(config.hardMaxAgents, DEFAULT_CONFIG.hardMaxAgents);
    const requested = config.maxAgents ?? config.defaultMaxAgents;
    if (!Number.isInteger(requested) || requested < 1) throw new Error('maxAgents must be a positive integer');
    const maxAgents = Math.min(requested, hardCap);
    const decomposer = new TaskDecomposer({ maxAgents });
    const subtasks = decomposer.decompose(task.id, task.prompt);
    const events = new CoordinationEventEmitter();
    const store = new CoordinationStateStore(events);
    store.create(task.id, subtasks);

    const changes = new Map<string, ChangeSet>();
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (!signal.aborted) {
        const index = cursor++;
        const subtask = subtasks[index];
        if (!subtask) return;
        const agentId = `agent-${index + 1}` as AgentId;
        store.start(subtask.id, agentId);
        try {
          const result = await this.executeSubtask(subtask, agentId, signal);
          if (signal.aborted) {
            store.cancel(subtask.id);
            return;
          }
          if (result.claimedPaths) store.claimPaths(subtask.id, result.claimedPaths);
          store.complete(subtask.id, result.changeSet.id);
          changes.set(subtask.id, result.changeSet);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (signal.aborted) store.cancel(subtask.id);
          else store.fail(subtask.id, message);
        }
      }
    };

    const workers = Array.from({ length: Math.min(maxAgents, subtasks.length) }, () => worker());
    await Promise.all(workers);

    if (signal.aborted) {
      for (const run of store.snapshot().runs) {
        if (run.status === 'queued' || run.status === 'running') store.cancel(run.subtaskId);
      }
      return this.result('cancelled', store.snapshot().runs, [], [], undefined);
    }

    const snapshot = store.snapshot();
    const failures = snapshot.runs
      .filter((run) => run.status === 'failed')
      .map((run) => ({ subtaskId: run.subtaskId, error: run.error ?? 'subtask failed' }));
    if (failures.length > 0) return this.result('failed', snapshot.runs, [], failures, undefined);

    const conflictReport = new ConflictDetector().detect(snapshot.runs.filter((run) => run.status === 'completed'));
    if (conflictReport.conflicts.length > 0) {
      for (const conflict of conflictReport.conflicts) store.conflict(conflict.subtaskIds, conflict.paths);
      return this.result('conflict', store.snapshot().runs, conflictReport.conflicts, [], undefined);
    }

    const combined = new ChangeSetAggregator().aggregate([...changes.values()]);
    return this.result('completed', store.snapshot().runs, [], [], combined);
  }

  private result(
    status: CoordinationResult['status'],
    runs: AgentRunRecord[],
    conflicts: CoordinationResult['conflicts'],
    failures: CoordinationResult['failures'],
    combinedChangeSet?: ChangeSet,
  ): CoordinationResult {
    return {
      status,
      runs,
      conflicts,
      failures,
      ...(combinedChangeSet ? { combinedChangeSet } : {}),
    };
  }
}
