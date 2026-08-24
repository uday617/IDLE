import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectLearningService } from '../../src/learning/ProjectLearningService.js';
import { MemoryRepository } from '../../src/memory/MemoryRepository.js';
import { ProjectMemory } from '../../src/memory/ProjectMemory.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('ProjectLearningService', () => {
  it('persists validated project learning and retrieves it for a task', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-project-learning-'));
    temporaryDirectories.push(directory);
    const learning = new ProjectLearningService(
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );

    await learning.learn('PostgreSQL connections use the shared pool', {
      confidence: 0.95,
      source: 'verification',
      validated: true,
    });

    const restored = new ProjectLearningService(
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );
    const facts = await restored.recall('database PostgreSQL', 5);

    expect(facts).toHaveLength(1);
    expect(facts[0]?.fact).toBe('PostgreSQL connections use the shared pool');
    expect(facts[0]?.metadata).toEqual({
      confidence: 0.95,
      source: 'verification',
      validated: true,
    });
  });

  it('does not persist unvalidated learning', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-project-learning-'));
    temporaryDirectories.push(directory);
    const learning = new ProjectLearningService(
      new ProjectMemory('project-1', new MemoryRepository(directory)),
    );

    await expect(learning.learn('Maybe the project uses Redis', {
      confidence: 0.5,
      source: 'agent',
      validated: false,
    })).rejects.toThrow('only validated project facts may be persisted');

    expect(await learning.recall('Redis')).toEqual([]);
  });
});
