import { describe, expect, it } from 'vitest';
import { FailureContextBuilder } from '../../src/agents/FailureContextBuilder.js';

describe('FailureContextBuilder', () => {
  it('normalizes verification failure evidence', () => {
    const result = FailureContextBuilder.fromVerificationResult({
      taskId: 'task-1',
      attempt: 1,
      checkId: 'typecheck',
      exitCode: 1,
      stdout: 'stdout',
      stderr: 'TS error',
      affectedPaths: ['src/a.ts', 'src/a.ts'],
      changeSetId: 'cs-1',
    });

    expect(result).toEqual({
      taskId: 'task-1',
      attempt: 1,
      checkId: 'typecheck',
      exitCode: 1,
      stdoutExcerpt: 'stdout',
      stderrExcerpt: 'TS error',
      affectedPaths: ['src/a.ts'],
      changeSetId: 'cs-1',
      previousAttempts: [],
    });
  });

  it('bounds large output', () => {
    const output = 'x'.repeat(FailureContextBuilder.MAX_EXCERPT_CHARS + 100);
    const result = FailureContextBuilder.truncate(output, FailureContextBuilder.MAX_EXCERPT_CHARS);
    expect(result).toHaveLength(FailureContextBuilder.MAX_EXCERPT_CHARS);
    expect(result.endsWith('…')).toBe(true);
  });
});
