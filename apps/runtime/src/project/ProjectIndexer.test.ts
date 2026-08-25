import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectIndexer } from './ProjectIndexer.js';
import { ProjectService } from './ProjectService.js';

describe('ProjectIndexer', () => {
  it('reports initial files as added and later scans only changed state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-indexer-'));
    await writeFile(join(root, 'a.ts'), 'export const a = 1;');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const indexer = new ProjectIndexer(projects);

    await expect(indexer.update(project.id)).resolves.toMatchObject({
      added: ['a.ts'],
      changed: [],
      removed: [],
    });

    await expect(indexer.update(project.id)).resolves.toMatchObject({
      added: [],
      changed: [],
      removed: [],
    });
  });

  it('reports additions, removals, and modifications between updates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-indexer-'));
    await writeFile(join(root, 'a.ts'), 'a');
    await writeFile(join(root, 'remove.ts'), 'remove');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const indexer = new ProjectIndexer(projects);

    await indexer.update(project.id);
    await writeFile(join(root, 'a.ts'), 'changed content');
    await writeFile(join(root, 'add.ts'), 'add');
    const { rm } = await import('node:fs/promises');
    await rm(join(root, 'remove.ts'));

    await expect(indexer.update(project.id)).resolves.toMatchObject({
      added: ['add.ts'],
      changed: ['a.ts'],
      removed: ['remove.ts'],
    });
  });
});
