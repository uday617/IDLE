import { describe, expect, it } from 'vitest';
import { ConflictDetector } from './ConflictDetector.js';
import type { AgentId, AgentRunRecord } from '@idle/contracts';

describe('ConflictDetector', () => {
  const run = (subtaskId: string, claimedPaths: string[]): AgentRunRecord => ({
    subtaskId,
    agentId: `${subtaskId}-agent` as AgentId,
    status: 'completed',
    claimedPaths,
  });

  it('allows disjoint paths', () => {
    expect(new ConflictDetector().detect([run('a', ['src/a.ts']), run('b', ['src/b.ts'])])).toEqual({ conflicts: [] });
  });

  it('detects identical paths', () => {
    expect(new ConflictDetector().detect([run('a', ['src/a.ts']), run('b', ['src/a.ts'])])).toEqual({
      conflicts: [{ subtaskIds: ['a', 'b'], paths: ['src/a.ts'] }],
    });
  });

  it('normalizes equivalent relative paths deterministically', () => {
    expect(new ConflictDetector().detect([run('b', ['./src/a.ts']), run('a', ['src/../src/a.ts'])])).toEqual({
      conflicts: [{ subtaskIds: ['a', 'b'], paths: ['src/a.ts'] }],
    });
  });

  it('does not infer a conflict for a subtask without claimed paths', () => {
    expect(new ConflictDetector().detect([run('a', []), run('b', ['src/a.ts'])])).toEqual({ conflicts: [] });
  });
});
