import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import { ProjectService } from '../../src/project/ProjectService.js';
import { FileService } from '../../src/project/FileService.js';
import { ChangeSetService } from '../../src/project/ChangeSetService.js';

async function openedProject(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
  for (const [path, content] of Object.entries(files)) await writeFile(join(root, path), content, 'utf8');
  const projects = new ProjectService();
  const project = await projects.open(root);
  return { root, project, service: new ChangeSetService(new FileService(projects)) };
}

describe('ChangeSetService', () => {
  it('applies a valid multi-file change set', async () => {
    const { root, project, service } = await openedProject({ 'a.ts': 'const a = 1;\n', 'b.ts': 'const b = 1;\n' });
    const changeSet: ChangeSet = { id: 'multi', description: 'update both files', changes: [
      { operation: 'modify', path: 'a.ts', baseContent: 'const a = 1;\n', hunks: [{ oldStart: 1, oldLines: ['const a = 1;'], newLines: ['const a = 2;'] }] },
      { operation: 'modify', path: 'b.ts', baseContent: 'const b = 1;\n', hunks: [{ oldStart: 1, oldLines: ['const b = 1;'], newLines: ['const b = 2;'] }] },
    ] };
    await expect(service.apply(project.id, changeSet)).resolves.toEqual({ ok: true });
    await expect(readFile(join(root, 'a.ts'), 'utf8')).resolves.toBe('const a = 2;\n');
    await expect(readFile(join(root, 'b.ts'), 'utf8')).resolves.toBe('const b = 2;\n');
  });

  it('rejects the whole change set when one file is stale', async () => {
    const { root, project, service } = await openedProject({ 'a.ts': 'const a = 1;\n', 'b.ts': 'const b = 2;\n' });
    const changeSet: ChangeSet = { id: 'atomic', description: 'should not partially apply', changes: [
      { operation: 'modify', path: 'a.ts', baseContent: 'const a = 1;\n', hunks: [{ oldStart: 1, oldLines: ['const a = 1;'], newLines: ['const a = 3;'] }] },
      { operation: 'modify', path: 'b.ts', baseContent: 'const b = 1;\n', hunks: [{ oldStart: 1, oldLines: ['const b = 1;'], newLines: ['const b = 3;'] }] },
    ] };
    await expect(service.apply(project.id, changeSet)).rejects.toThrow();
    await expect(readFile(join(root, 'a.ts'), 'utf8')).resolves.toBe('const a = 1;\n');
    await expect(readFile(join(root, 'b.ts'), 'utf8')).resolves.toBe('const b = 2;\n');
  });
});
