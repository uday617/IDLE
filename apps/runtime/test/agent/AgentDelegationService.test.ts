import { describe, expect, it } from 'vitest';
import { AgentDelegationService } from '../../src/agent/AgentDelegationService.js';
import { AgentLearningService } from '../../src/agent/AgentLearningService.js';
import { AgentMemoryService } from '../../src/agent/AgentMemoryService.js';
import { AgentRequestService, type AgentPolicy } from '../../src/agent/AgentRequestService.js';

const policy: AgentPolicy = { allowedCapabilities: ['read'], maxAutonomy: 2 };

function services() {
  const memory = new AgentMemoryService();
  const learning = new AgentLearningService(memory);
  const requests = new AgentRequestService(new Map([['parent-1', policy]]));
  return { memory, delegation: new AgentDelegationService(requests, learning) };
}

describe('AgentDelegationService', () => {
  it('allows delegation, passes child memory, and records the outcome', async () => {
    const { memory, delegation } = services();
    memory.remember('child-1', 'Previous read task used the project manifest', ['history']);
    let receivedContext = false;

    const result = await delegation.delegate(
      'parent-1',
      'child-1',
      { capability: 'read', autonomy: 1 },
      'read the project manifest',
      {
        execute: async (context) => {
          receivedContext = context.memories.some((entry) => entry.content.includes('project manifest'));
          return { success: true, result: 'done', summary: 'Manifest read successfully' };
        },
      },
    );

    expect(result).toMatchObject({ decision: 'allow', result: 'done' });
    expect(receivedContext).toBe(true);
    expect(memory.recall('child-1', { tag: 'success' })).toHaveLength(1);
  });

  it('does not execute a denied delegation', async () => {
    const { delegation } = services();
    let executed = false;
    const result = await delegation.delegate(
      'parent-1',
      'child-1',
      { capability: 'shell', autonomy: 1 },
      'run shell command',
      { execute: async () => { executed = true; return { success: true, result: 'bad', summary: 'should not run' }; } },
    );
    expect(result.decision).toBe('deny');
    expect(executed).toBe(false);
  });

  it('does not execute when approval is required', async () => {
    const { delegation } = services();
    let executed = false;
    const result = await delegation.delegate(
      'parent-1',
      'child-1',
      { capability: 'read', autonomy: 1, requiresApproval: true },
      'read file',
      { execute: async () => { executed = true; return { success: true, result: 'bad', summary: 'should not run' }; } },
    );
    expect(result.decision).toBe('approval_required');
    expect(executed).toBe(false);
  });

  it('records failed execution without leaking memory to another agent', async () => {
    const { memory, delegation } = services();
    await expect(delegation.delegate(
      'parent-1',
      'child-1',
      { capability: 'read', autonomy: 1 },
      'read configuration',
      { execute: async () => { throw new Error('read failed'); } },
    )).rejects.toThrow('read failed');

    expect(memory.recall('child-1', { tag: 'failure' })).toHaveLength(1);
    expect(memory.recall('child-2')).toEqual([]);
  });
});
