import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRepository } from '../../src/memory/MemoryRepository.js';
import { ProjectMemory } from '../../src/memory/ProjectMemory.js';
import { ShortTermMemory } from '../../src/memory/ShortTermMemory.js';
import { TaskMemory } from '../../src/memory/TaskMemory.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('ShortTermMemory', () => {
  it('expires entries after the configured TTL', () => {
    let now = 1_000;
    const memory = new ShortTermMemory({ ttlMs: 100, now: () => now, idFactory: () => 'entry-1' });

    memory.append('recent');
    expect(memory.list()).toEqual(['recent']);

    now = 1_101;
    expect(memory.list()).toEqual([]);
  });
});

describe('TaskMemory', () => {
  it('isolates memories by task id', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-memory-'));
    temporaryDirectories.push(directory);
    const repository = new MemoryRepository(directory);
    const first = new TaskMemory('task-1', repository);
    const second = new TaskMemory('task-2', repository);

    await first.save({ result: 'first' });
    await second.save({ result: 'second' });

    expect(await first.list()).toEqual([{ result: 'first' }]);
    expect(await second.list()).toEqual([{ result: 'second' }]);
  });
});

describe('ProjectMemory', () => {
  it('persists validated project facts across repository instances', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-memory-'));
    temporaryDirectories.push(directory);
    const firstRepository = new MemoryRepository(directory);
    const firstMemory = new ProjectMemory('project-1', firstRepository);

    await firstMemory.saveFact('Use TypeScript strict mode', {
      confidence: 0.95,
      source: 'verification',
      validated: true,
    });

    const secondMemory = new ProjectMemory('project-1', new MemoryRepository(directory));
    expect(await secondMemory.listFacts()).toHaveLength(1);
    expect(await secondMemory.retrieveFacts('typescript')).toHaveLength(1);
  });

  it('rejects unvalidated assumptions and invalid confidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'idle-memory-'));
    temporaryDirectories.push(directory);
    const memory = new ProjectMemory('project-1', new MemoryRepository(directory));

    await expect(memory.saveFact('maybe true', {
      confidence: 0.5,
      source: 'agent',
      validated: false,
    })).rejects.toThrow('only validated project facts may be persisted');

    await expect(memory.saveFact('invalid', {
      confidence: 2,
      source: 'agent',
      validated: true,
    })).rejects.toThrow('confidence must be between 0 and 1');
  });
});
