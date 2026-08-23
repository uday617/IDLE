import { describe, expect, it } from 'vitest';
import { CoordinationStateStore } from './CoordinationStateStore.js';
import { CoordinationEventEmitter } from './CoordinationEventEmitter.js';
import type { AgentSubtask, AgentId, TaskId } from '@idle/contracts';

describe('CoordinationStateStore', () => {
  const taskId = 'task-1' as TaskId;
  const agentId = 'agent-1' as AgentId;
  const subtasks: AgentSubtask[] = [
    { id: 'subtask-1', parentTaskId: taskId, prompt: 'First' },
    { id: 'subtask-2', parentTaskId: taskId, prompt: 'Second' },
  ];

  it('tracks the legal lifecycle and returns immutable snapshots', () => {
    const store = new CoordinationStateStore(new CoordinationEventEmitter());
    const created = store.create(taskId, subtasks);
    expect(created.runs.map((run) => run.status)).toEqual(['queued', 'queued']);

    store.start('subtask-1', agentId);
    store.claimPaths('subtask-1', ['src/a.ts']);
    store.complete('subtask-1', 'changeset-1');

    const snapshot = store.snapshot();
    expect(snapshot.runs[0]).toMatchObject({ status: 'completed', agentId, claimedPaths: ['src/a.ts'], changeSetId: 'changeset-1' });
    expect(() => snapshot.runs.push(snapshot.runs[0]!)).toThrow();
  });

  it('rejects invalid lifecycle transitions', () => {
    const store = new CoordinationStateStore(new CoordinationEventEmitter());
    store.create(taskId, subtasks);

    expect(() => store.complete('subtask-1', 'changeset-1')).toThrow('cannot complete');
    store.start('subtask-1', agentId);
    expect(() => store.start('subtask-1', agentId)).toThrow('cannot start');
    expect(() => store.fail('subtask-2', 'boom')).toThrow('cannot fail');
  });

  it('emits structured lifecycle events', () => {
    const emitter = new CoordinationEventEmitter();
    const events: string[] = [];
    emitter.on((event) => events.push(event.type));
    const store = new CoordinationStateStore(emitter);

    store.create(taskId, subtasks);
    store.start('subtask-1', agentId);
    store.claimPaths('subtask-1', ['src/a.ts']);
    store.complete('subtask-1', 'changeset-1');

    expect(events).toEqual(['coordination.created', 'subtask.started', 'subtask.claimed', 'subtask.completed']);
  });
});
