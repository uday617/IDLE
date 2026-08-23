import { describe, expect, it } from 'vitest';
import { TaskDecomposer } from './TaskDecomposer.js';
import type { TaskId } from '@idle/contracts';

describe('TaskDecomposer', () => {
  const taskId = 'task-1' as TaskId;

  it('falls back to one subtask when no independent markers are present', () => {
    const result = new TaskDecomposer({ maxAgents: 2 }).decompose(taskId, 'Inspect the project and fix the issue.');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ parentTaskId: taskId, prompt: 'Inspect the project and fix the issue.' });
  });

  it('decomposes explicitly independent subtasks with claimed paths', () => {
    const prompt = [
      'SUBTASK 1: Update the parser',
      'PATHS: src/parser.ts',
      '',
      'SUBTASK 2: Update the renderer',
      'PATHS: src/renderer.ts, src/view.ts',
    ].join('\n');

    const result = new TaskDecomposer({ maxAgents: 2 }).decompose(taskId, prompt);

    expect(result).toHaveLength(2);
    expect(result[0]?.claimedPaths).toEqual(['src/parser.ts']);
    expect(result[1]?.claimedPaths).toEqual(['src/renderer.ts', 'src/view.ts']);
  });

  it('clamps decomposition to the configured maximum', () => {
    const prompt = [
      'SUBTASK 1: First',
      'PATHS: a.ts',
      '',
      'SUBTASK 2: Second',
      'PATHS: b.ts',
      '',
      'SUBTASK 3: Third',
      'PATHS: c.ts',
    ].join('\n');

    const result = new TaskDecomposer({ maxAgents: 2 }).decompose(taskId, prompt);

    expect(result).toHaveLength(2);
    expect(result.map((subtask) => subtask.claimedPaths)).toEqual([['a.ts'], ['b.ts']]);
  });
});
