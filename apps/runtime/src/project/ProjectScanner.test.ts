import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectService } from './ProjectService.js';
import { ProjectScanner } from './ProjectScanner.js';

describe('ProjectScanner', () => {
  it('scans project files as stable relative records while ignoring generated and VCS directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-scanner-'));
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'node_modules', 'ignored'), { recursive: true });
    await mkdir(join(root, '.git', 'ignored'), { recursive: true });
    await mkdir(join(root, 'dist', 'ignored'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export const answer = 42;');
    await writeFile(join(root, 'README.md'), '# IDLE');
    await writeFile(join(root, 'node_modules', 'ignored', 'package.js'), 'ignored');
    await writeFile(join(root, '.git', 'ignored', 'config'), 'ignored');
    await writeFile(join(root, 'dist', 'ignored', 'bundle.js'), 'ignored');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const scanner = new ProjectScanner(projects);

    await expect(scanner.scan(project.id)).resolves.toEqual([
      { path: 'README.md', kind: 'file', extension: '.md' },
      { path: 'src/index.ts', kind: 'file', extension: '.ts' },
    ]);
  });

  it('returns deterministic records for an empty project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-scanner-'));
    const projects = new ProjectService();
    const project = await projects.open(root);
    const scanner = new ProjectScanner(projects);

    await expect(scanner.scan(project.id)).resolves.toEqual([]);
  });
});
