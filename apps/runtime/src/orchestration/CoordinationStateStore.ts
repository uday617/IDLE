import type { AgentId, AgentRunRecord, AgentSubtask, CoordinationEvent, TaskId } from '@idle/contracts';
import { COORDINATION_EVENT_TYPES } from '@idle/contracts';
import { CoordinationEventEmitter } from './CoordinationEventEmitter.js';

export interface CoordinationState {
  taskId: TaskId;
  runs: AgentRunRecord[];
}

const freezeState = (state: CoordinationState): CoordinationState => {
  for (const run of state.runs) {
    Object.freeze(run.claimedPaths);
    Object.freeze(run);
  }
  Object.freeze(state.runs);
  return Object.freeze(state);
};

export class CoordinationStateStore {
  private state: CoordinationState | null = null;
  private eventCounter = 0;

  constructor(private readonly events: CoordinationEventEmitter) {}

  create(taskId: TaskId, subtasks: AgentSubtask[]): CoordinationState {
    if (this.state) throw new Error('coordination state already exists');
    this.state = {
      taskId,
      runs: subtasks.map((subtask) => ({
        subtaskId: subtask.id,
        agentId: '' as AgentId,
        status: 'queued',
        claimedPaths: [...(subtask.claimedPaths ?? [])],
      })),
    };
    this.emit(COORDINATION_EVENT_TYPES.CREATED, { subtaskIds: subtasks.map((subtask) => subtask.id) });
    return this.snapshot();
  }

  start(subtaskId: string, agentId: AgentId): void {
    const run = this.find(subtaskId);
    if (run.status !== 'queued') throw new Error(`subtask ${subtaskId} cannot start from ${run.status}`);
    run.agentId = agentId;
    run.status = 'running';
    this.emit(COORDINATION_EVENT_TYPES.STARTED, { subtaskId, agentId });
  }

  claimPaths(subtaskId: string, paths: string[]): void {
    const run = this.find(subtaskId);
    if (run.status !== 'running') throw new Error(`subtask ${subtaskId} cannot claim paths from ${run.status}`);
    run.claimedPaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
    this.emit(COORDINATION_EVENT_TYPES.CLAIMED, { subtaskId, paths: run.claimedPaths });
  }

  complete(subtaskId: string, changeSetId: string): void {
    const run = this.find(subtaskId);
    if (run.status !== 'running') throw new Error(`subtask ${subtaskId} cannot complete from ${run.status}`);
    run.status = 'completed';
    run.changeSetId = changeSetId;
    this.emit(COORDINATION_EVENT_TYPES.COMPLETED, { subtaskId, changeSetId });
  }

  fail(subtaskId: string, error: string): void {
    const run = this.find(subtaskId);
    if (run.status !== 'running') throw new Error(`subtask ${subtaskId} cannot fail from ${run.status}`);
    run.status = 'failed';
    run.error = error;
    this.emit(COORDINATION_EVENT_TYPES.FAILED, { subtaskId, error });
  }

  cancel(subtaskId: string): void {
    const run = this.find(subtaskId);
    if (run.status !== 'queued' && run.status !== 'running') throw new Error(`subtask ${subtaskId} cannot cancel from ${run.status}`);
    run.status = 'cancelled';
    this.emit(COORDINATION_EVENT_TYPES.CANCELLED, { subtaskId });
  }

  conflict(subtaskIds: string[], paths: string[]): void {
    for (const subtaskId of subtaskIds) {
      const run = this.find(subtaskId);
      if (run.status !== 'completed') throw new Error(`subtask ${subtaskId} cannot enter conflict from ${run.status}`);
      run.status = 'conflict';
    }
    this.emit(COORDINATION_EVENT_TYPES.CONFLICT, { subtaskIds, paths });
  }

  snapshot(): CoordinationState {
    if (!this.state) throw new Error('coordination state has not been created');
    return freezeState({
      taskId: this.state.taskId,
      runs: this.state.runs.map((run) => ({ ...run, claimedPaths: [...run.claimedPaths] })),
    });
  }

  private find(subtaskId: string): AgentRunRecord {
    if (!this.state) throw new Error('coordination state has not been created');
    const run = this.state.runs.find((candidate) => candidate.subtaskId === subtaskId);
    if (!run) throw new Error(`unknown subtask: ${subtaskId}`);
    return run;
  }

  private emit(type: string, payload: unknown): void {
    if (!this.state) throw new Error('coordination state has not been created');
    const event: CoordinationEvent = {
      id: `coord-${++this.eventCounter}`,
      timestamp: new Date().toISOString(),
      taskId: this.state.taskId,
      type,
      payload,
    };
    this.events.emit(event);
  }
}
