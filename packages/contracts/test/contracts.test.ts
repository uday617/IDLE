import { describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  AgentId,
  AgentRunRecord,
  AgentRunStatus,
  AgentSubtask,
  CoordinationEvent,
  MultiAgentConfig,
  TaskId,
} from '../src/index.js';

describe('shared contracts', () => {
  it('represents a structured agent event', () => {
    const event: AgentEvent = {
      id: 'event-1',
      timestamp: new Date(0).toISOString(),
      taskId: 'task-1' as TaskId,
      agentId: 'agent-1' as AgentId,
      type: 'TASK_STARTED',
      payload: { ok: true },
    };

    expect(event.type).toBe('TASK_STARTED');
    expect(event.payload).toEqual({ ok: true });
  });

  it('represents a serializable multi-agent subtask and run record', () => {
    const subtask: AgentSubtask = {
      id: 'subtask-1',
      parentTaskId: 'task-1' as TaskId,
      prompt: 'Update the parser',
      claimedPaths: ['src/parser.ts'],
    };
    const status: AgentRunStatus = 'queued';
    const run: AgentRunRecord = {
      subtaskId: subtask.id,
      agentId: 'agent-1' as AgentId,
      status,
      claimedPaths: subtask.claimedPaths ?? [],
    };

    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  it('uses safe orchestration defaults and preserves the hard cap', () => {
    const config: MultiAgentConfig = {
      defaultMaxAgents: 2,
      hardMaxAgents: 4,
    };

    expect(config).toEqual({ defaultMaxAgents: 2, hardMaxAgents: 4 });
    expect(config.defaultMaxAgents).toBeLessThanOrEqual(config.hardMaxAgents);
  });

  it('represents structured coordination events without direct agent messaging', () => {
    const event: CoordinationEvent = {
      id: 'coord-1',
      timestamp: new Date(0).toISOString(),
      taskId: 'task-1' as TaskId,
      type: 'subtask.started',
      payload: { subtaskId: 'subtask-1' },
    };

    expect(JSON.stringify(event)).toContain('subtask.started');
    expect(event.payload).toEqual({ subtaskId: 'subtask-1' });
  });
});
