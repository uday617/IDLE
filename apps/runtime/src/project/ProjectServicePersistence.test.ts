import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectService } from './ProjectService.js';

describe('ProjectService persistence', () => {
  it('restores a project id for the same path after restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-identity-'));
    const storeDir = await mkdtemp(join(tmpdir(), 'idle-project-store-'));
    const storePath = join(storeDir, 'projects.json');
    await mkdir(join(root, 'src'));

    const first = new ProjectService(storePath);
    const project = await first.open(root);

    const restarted = new ProjectService(storePath);
    await restarted.load();

    await expect(restarted.open(root)).resolves.toEqual(project);
  });
});
