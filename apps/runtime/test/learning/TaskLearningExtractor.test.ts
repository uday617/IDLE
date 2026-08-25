import { describe, expect, it } from 'vitest';
import { TaskLearningExtractor } from '../../src/learning/TaskLearningExtractor.js';

describe('TaskLearningExtractor', () => {
  const extractor = new TaskLearningExtractor();

  it('extracts a verified solution lesson from a completed outcome', () => {
    const lesson = extractor.extract({
      taskId: 'task-1',
      projectId: 'project-1',
      status: 'completed',
      verification: 'passed',
      prompt: 'Fix the database connection pool',
      summary: 'The shared PostgreSQL pool fixed connection exhaustion.',
    });

    expect(lesson).toEqual({
      kind: 'solution',
      statement: 'The shared PostgreSQL pool fixed connection exhaustion.',
      evidenceTaskId: 'task-1',
      evidence: 'verification=passed; status=completed',
    });
  });

  it('does not learn from failed or unverified outcomes', () => {
    expect(extractor.extract({
      taskId: 'task-2',
      projectId: 'project-1',
      status: 'failed',
      verification: 'failed',
      summary: 'A guessed fix failed.',
    })).toBeUndefined();

    expect(extractor.extract({
      taskId: 'task-3',
      projectId: 'project-1',
      status: 'completed',
      verification: 'not-run',
      summary: 'It seems to work.',
    })).toBeUndefined();
  });

  it('bounds lesson text and removes credential-like values', () => {
    const lesson = extractor.extract({
      taskId: 'task-4',
      projectId: 'project-1',
      status: 'completed',
      verification: 'passed',
      summary: `token=secret123 ${'x'.repeat(2500)}`,
    });

    expect(lesson?.statement).not.toContain('secret123');
    expect(lesson?.statement.length).toBeLessThanOrEqual(2000);
  });
});
