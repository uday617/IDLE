import { describe, expect, it } from 'vitest';
import type { AgentEvent, AgentId, TaskId } from '../src/index.js';

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
});
