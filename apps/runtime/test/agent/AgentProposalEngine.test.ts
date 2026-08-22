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

  it('turns an explicit line replacement into a modify change using the inspected base', () => {
    const files = [{ path: 'src/example.txt', content: 'first\nold value\nlast\n' }];

    const changeSet = new AgentProposalEngine().propose({
      taskId: 'task-4',
      goal: 'Replace line "old value" with "new value" in file "src/example.txt"',
      files,
    });

    expect(changeSet.changes).toEqual([
      {
        operation: 'modify',
        path: 'src/example.txt',
        baseContent: 'first\nold value\nlast\n',
        hunks: [
          {
            oldStart: 2,
            oldLines: ['old value'],
            newLines: ['new value'],
          },
        ],
      },
    ]);
  });

  it('rejects a modify proposal when the inspected file is missing', () => {
    expect(() =>
      new AgentProposalEngine().propose({
        taskId: 'task-5',
        goal: 'Replace line "old" with "new" in file "missing.txt"',
        files: [],
      }),
    ).toThrow('Inspected file not found: missing.txt');
  });

  it('does not mutate the inspected file snapshot', () => {
    const files = [{ path: 'src/example.txt', content: 'old value' }];
    const before = structuredClone(files);

    new AgentProposalEngine().propose({
      taskId: 'task-6',
      goal: 'Replace line "old value" with "new value" in file "src/example.txt"',
      files,
    });

    expect(files).toEqual(before);
  });

  it('returns no proposal for unsupported goals', () => {
    const result = new AgentProposalEngine().propose({
      taskId: 'task-7',
      goal: 'inspect the project and make it better',
    });

    expect(result).toEqual({
      id: 'proposal-task-7',
      description: 'inspect the project and make it better',
      changes: [],
    });
  });
});
