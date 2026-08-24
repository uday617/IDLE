import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRepository } from '../../src/memory/MemoryRepository.js';
import { ProjectMemoryRetriever } from '../../src/memory/ProjectMemoryRetriever.js';

describe('ProjectMemoryRetriever', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it('retrieves validated project facts using the task prompt as the query', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-project-memory-retriever-'));
    temporaryDirectories.push(directory);
    const repository = new MemoryRepository(directory);
    await repository.saveProjectFact('Use PostgreSQL for persistence', {
      confidence: 0.95,
      source: 'verification',
      validated: true,
    });
    await repository.saveProjectFact('Use Vitest for tests', {
      confidence: 0.9,
      source: 'user',
      validated: true,
    });

    const retriever = new ProjectMemoryRetriever(repository);

    await expect(retriever.retrieve('project-1', 'PostgreSQL persistence', 5)).resolves.toEqual([
      expect.objectContaining({ fact: 'Use PostgreSQL for persistence', projectId: 'project-1' }),
    ]);
  });
});
