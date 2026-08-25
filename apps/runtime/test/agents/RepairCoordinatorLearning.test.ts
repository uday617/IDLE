import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RepairCoordinator } from '../../src/agents/RepairCoordinator.js';
import { MemoryRepository } from '../../src/memory/MemoryRepository.js';
import { TaskMemoryRecorder } from '../../src/memory/TaskMemoryRecorder.js';
import { TaskLearningService } from '../../src/learning/TaskLearningService.js';
import { ProjectMemory } from '../../src/memory/ProjectMemory.js';
import { TaskService } from '../../src/tasks/TaskService.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('RepairCoordinator learning integration', () => {
  it('persists a lesson when repair verification succeeds', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-repair-learning-'));
    temporaryDirectories.push(directory);

    const taskService = new TaskService();
    await taskService.create('task-repair-learning', 'project-1', 'Use the shared PostgreSQL pool for database access');
    await taskService.start('task-repair-learning');

    const memoryRepository = new MemoryRepository(directory);
    const memoryRecorder = new TaskMemoryRecorder(memoryRepository, {
      async learn(outcome) {
        await new TaskLearningService(new ProjectMemory(outcome.projectId, memoryRepository)).learnFromOutcome(outcome);
      },
    });

    const coordinator = new RepairCoordinator(taskService, { memoryRecorder });
    coordinator.start('task-repair-learning');

    await expect(coordinator.onVerificationSuccess('task-repair-learning')).resolves.toMatchObject({ kind: 'completed' });

    const learning = new TaskLearningService(new ProjectMemory('project-1', memoryRepository));
    await expect(learning.recall('PostgreSQL pool', 5)).resolves.toHaveLength(1);
    await expect(learning.recall('PostgreSQL pool', 5)).resolves.toMatchObject([
      [expect.objectContaining({ fact: expect.objectContaining({ kind: 'solution' }) })][0],
    ]);
  });
});
