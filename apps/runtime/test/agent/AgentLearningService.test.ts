import { describe, expect, it } from 'vitest';
import { AgentLearningService } from '../../src/agent/AgentLearningService.js';
import { AgentMemoryService } from '../../src/agent/AgentMemoryService.js';

describe('AgentLearningService', () => {
  it('recalls relevant memories for a task', () => {
    const memory = new AgentMemoryService();
    memory.remember('agent-1', 'PostgreSQL connection pooling is required', ['database']);
    memory.remember('agent-1', 'Use Vitest for unit tests', ['testing']);
    memory.remember('agent-2', 'PostgreSQL belongs to another agent');
    const learning = new AgentLearningService(memory);

    const context = learning.recallForTask({ agentId: 'agent-1', description: 'Improve PostgreSQL database integration' });
    expect(context.memories).toHaveLength(1);
    expect(context.memories[0].content).toContain('PostgreSQL');
  });

  it('records successful outcomes as reusable memory', () => {
    const memory = new AgentMemoryService();
    const learning = new AgentLearningService(memory);
    const entry = learning.recordOutcome(
      { agentId: 'agent-1', description: 'database migration', tags: ['database'] },
      { success: true, summary: 'Migration completed after validating the schema', tags: ['migration'] },
    );

    expect(entry).not.toBeNull();
    expect(memory.recall('agent-1')).toEqual([expect.objectContaining({
      content: 'Migration completed after validating the schema',
      tags: expect.arrayContaining(['database', 'migration', 'success']),
    })]);
  });

  it('records failed outcomes without leaking them to another agent', () => {
    const memory = new AgentMemoryService();
    const learning = new AgentLearningService(memory);
    learning.recordOutcome(
      { agentId: 'agent-1', description: 'deploy application' },
      { success: false, summary: 'Deployment failed because the build was stale' },
    );

    expect(memory.recall('agent-1', { tag: 'failure' })).toHaveLength(1);
    expect(memory.recall('agent-2')).toEqual([]);
  });

  it('degrades gracefully when memory operations fail', () => {
    const brokenMemory = {
      recall: () => { throw new Error('memory unavailable'); },
      remember: () => { throw new Error('memory unavailable'); },
    } as unknown as AgentMemoryService;
    const learning = new AgentLearningService(brokenMemory);

    expect(learning.recallForTask({ agentId: 'agent-1', description: 'continue task' })).toEqual({ memories: [] });
    expect(learning.recordOutcome(
      { agentId: 'agent-1', description: 'continue task' },
      { success: true, summary: 'completed' },
    )).toBeNull();
  });
});
