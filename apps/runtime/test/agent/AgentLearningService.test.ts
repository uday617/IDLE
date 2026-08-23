import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentLearningService } from '../../src/agent/AgentLearningService.js';
import { AgentMemoryService } from '../../src/agent/AgentMemoryService.js';
import { MemoryRepository } from '../../src/memory/MemoryRepository.js';
import { ProjectMemory } from '../../src/memory/ProjectMemory.js';

const temporaryDirectories: string[] = [];

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

  it('persists validated project learning and retrieves it for a related task', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-learning-'));
    temporaryDirectories.push(directory);
    const projectMemory = new ProjectMemory('project-1', new MemoryRepository(directory));
    const learning = new AgentLearningService(new AgentMemoryService(), projectMemory);

    await learning.recordProjectFact('project-1', 'Use pnpm for workspace package management', {
      confidence: 0.98,
      source: 'verification',
      validated: true,
    });

    const context = await learning.recallForTask({
      agentId: 'agent-1',
      projectId: 'project-1',
      description: 'Update the pnpm workspace configuration',
    });

    expect(context.projectFacts).toHaveLength(1);
    expect(context.projectFacts[0].fact).toBe('Use pnpm for workspace package management');

    const restartedLearning = new AgentLearningService(
      new AgentMemoryService(),
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );
    const restartedContext = await restartedLearning.recallForTask({
      agentId: 'agent-2',
      projectId: 'project-1',
      description: 'configure pnpm',
    });
    expect(restartedContext.projectFacts).toHaveLength(1);
  });
});
