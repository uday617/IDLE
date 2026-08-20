import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileService } from '../../src/project/FileService.js';
import { ProjectService } from '../../src/project/ProjectService.js';

describe('FileService.write', () => {
  it('writes content to a file inside the opened project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-file-write-'));
    await writeFile(join(root, 'README.md'), 'old');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const files = new FileService(projects);

    await files.write(project.id, 'README.md', 'new');

    await expect(readFile(join(root, 'README.md'), 'utf8')).resolves.toBe('new');
  });

  it('rejects writes outside the opened project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-file-write-'));
    const projects = new ProjectService();
    const project = await projects.open(root);
    const files = new FileService(projects);

    await expect(files.write(project.id, '../outside.txt', 'unsafe')).rejects.toThrow('outside the project');
  });

  it('rejects writes for unknown projects', async () => {
    const files = new FileService(new ProjectService());

    await expect(files.write('missing-project', 'README.md', 'unsafe')).rejects.toThrow('Project not found');
  });
});
