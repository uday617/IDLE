import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskLearningService } from '../../src/learning/TaskLearningService.js';
import { MemoryRepository } from '../../src/memory/MemoryRepository.js';
import { ProjectMemory } from '../../src/memory/ProjectMemory.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('TaskLearningService', () => {
  it('persists verified lessons and recalls them after repository restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-task-learning-'));
    temporaryDirectories.push(directory);

    const first = new TaskLearningService(
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );
    await first.learnFromOutcome({
      taskId: 'task-1',
      projectId: 'project-1',
      status: 'completed',
      verification: 'passed',
      summary: 'Use the shared PostgreSQL pool to avoid connection exhaustion.',
    });

    const restored = new TaskLearningService(
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );
    const lessons = await restored.recall('PostgreSQL connection', 5);

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.fact.kind).toBe('solution');
    expect(lessons[0]?.fact.statement).toContain('PostgreSQL pool');
    expect(lessons[0]?.metadata.validated).toBe(true);
  });

  it('does not persist failed or unverified outcomes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-task-learning-'));
    temporaryDirectories.push(directory);
    const learning = new TaskLearningService(
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );

    await expect(learning.learnFromOutcome({
      taskId: 'task-2',
      projectId: 'project-1',
      status: 'failed',
      verification: 'failed',
      summary: 'Do not reuse this failed approach.',
    })).resolves.toBeUndefined();

    await expect(learning.learnFromOutcome({
      taskId: 'task-3',
      projectId: 'project-1',
      status: 'completed',
      verification: 'not-run',
      summary: 'Unverified guess.',
    })).resolves.toBeUndefined();

    expect(await learning.recall('failed approach', 5)).toEqual([]);
  });
});
