import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileService } from './FileService.js';
import { ProjectService } from './ProjectService.js';

describe('FileService symlink boundary', () => {
  it('rejects reading through a directory symlink that escapes the project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-file-security-'));
    const outside = await mkdtemp(join(tmpdir(), 'idle-file-outside-'));
    await writeFile(join(outside, 'secret.txt'), 'secret');
    await symlink(outside, join(root, 'linked'), 'junction');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const files = new FileService(projects);

    await expect(files.read(project.id, 'linked/secret.txt')).rejects.toThrow('outside the project');
  });
});
