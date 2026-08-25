import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectGraph, type GraphFile } from './ProjectGraph.js';
import { ProjectGraphRepository } from './ProjectGraphRepository.js';

describe('ProjectGraph persistence', () => {
  it('restores graph relationships after a new graph instance is created', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'idle-project-graph-'));
    const repository = new ProjectGraphRepository(dataDir);
    const files: GraphFile[] = [
      { path: 'src/index.ts', imports: ['./helper.js'], symbols: ['run'] },
      { path: 'src/helper.ts', imports: [], symbols: ['helper'] },
    ];

    const first = new ProjectGraph(repository);
    await first.update('project-1', files);

    const restarted = new ProjectGraph(repository);
    await restarted.load('project-1');

    expect(restarted.relatedFiles('project-1', 'src/index.ts', 1)).toEqual(['src/helper.ts']);
  });
});
