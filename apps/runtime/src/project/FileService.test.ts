import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileService } from './FileService.js';
import { ProjectService } from './ProjectService.js';

describe('FileService', () => {
  it('lists immediate project children with stable relative paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-file-service-'));
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'README.md'), '# IDLE');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const files = new FileService(projects);

    await expect(files.list(project.id, '.')).resolves.toEqual([
      { name: 'README.md', path: 'README.md', kind: 'file' },
      { name: 'src', path: 'src', kind: 'directory' },
    ]);
  });

  it('lists a nested directory without escaping the project root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-file-service-'));
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src/index.ts'), 'export {};');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const files = new FileService(projects);

    await expect(files.list(project.id, 'src')).resolves.toEqual([
      { name: 'index.ts', path: 'src/index.ts', kind: 'file' },
    ]);
  });

  it('rejects paths outside the opened project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-file-service-'));
    const projects = new ProjectService();
    const project = await projects.open(root);
    const files = new FileService(projects);

    await expect(files.list(project.id, '../')).rejects.toThrow('outside the project');
  });

  it('rejects unknown projects', async () => {
    const projects = new ProjectService();
    const files = new FileService(projects);

    await expect(files.list('missing-project', '.')).rejects.toThrow('Project not found');
  });
});
