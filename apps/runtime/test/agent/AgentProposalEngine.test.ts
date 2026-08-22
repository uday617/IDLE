import { describe, expect, it } from 'vitest';
import { AgentProposalEngine } from '../../src/agents/AgentProposalEngine.js';

describe('AgentProposalEngine', () => {
  it('turns an explicit create-file instruction into a FileChange without mutating files', () => {
    const prompt = `Create file "config.json" with content:\n{"enabled":true}`;

    const changeSet = new AgentProposalEngine().propose({
      taskId: 'task-1',
      goal: prompt,
    });

    expect(changeSet).toEqual({
      id: 'proposal-task-1',
      description: prompt,
      changes: [
        {
          operation: 'create',
          path: 'config.json',
          baseContent: null,
          content: '{"enabled":true}',
        },
      ],
    });
  });

  it('rejects unsafe create paths', () => {
    expect(() =>
      new AgentProposalEngine().propose({
        taskId: 'task-2',
        goal: 'Create file "../config.json" with content:\n{}',
      }),
    ).toThrow('Unsafe file path');
  });

  it('supports multiple explicit create-file instructions deterministically', () => {
    const prompt = [
      'Create file "one.txt" with content:',
      'one',
      '',
      'Create file "two.txt" with content:',
      'two',
    ].join('\n');

    const changeSet = new AgentProposalEngine().propose({
      taskId: 'task-3',
      goal: prompt,
    });

    expect(changeSet.changes).toEqual([
      { operation: 'create', path: 'one.txt', baseContent: null, content: 'one' },
      { operation: 'create', path: 'two.txt', baseContent: null, content: 'two' },
    ]);
  });
});
