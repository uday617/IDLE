import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import { ChangeSetService } from '../../src/project/ChangeSetService.js';
import { FileService } from '../../src/project/FileService.js';
import { ProjectService } from '../../src/project/ProjectService.js';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('ChangeSetService', () => {
  it('applies a validated multi-file change set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
    await writeFile(join(root, 'a.txt'), 'one\n');
    await writeFile(join(root, 'b.txt'), 'two\n');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const service = new ChangeSetService(projects, new FileService(projects));
    const changeSet: ChangeSet = {
      id: 'cs-1',
      description: 'update both files',
      changes: [
        { operation: 'modify', path: 'a.txt', baseContent: 'one\n', hunks: [{ oldStart: 1, oldLines: ['one'], newLines: ['ONE'] }] },
        { operation: 'modify', path: 'b.txt', baseContent: 'two\n', hunks: [{ oldStart: 1, oldLines: ['two'], newLines: ['TWO'] }] },
      ],
    };

    await expect(service.apply(project.id, changeSet)).resolves.toEqual({ id: 'cs-1', changedFiles: ['a.txt', 'b.txt'] });
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('ONE\n');
    await expect(readFile(join(root, 'b.txt'), 'utf8')).resolves.toBe('TWO\n');
  });

  it('rejects stale changes before writing any file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
    await writeFile(join(root, 'a.txt'), 'one\n');
    await writeFile(join(root, 'b.txt'), 'two\n');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const service = new ChangeSetService(projects, new FileService(projects));
    const changeSet: ChangeSet = {
      id: 'cs-2',
      description: 'stale update',
      changes: [
        { operation: 'modify', path: 'a.txt', baseContent: 'stale\n', hunks: [{ oldStart: 1, oldLines: ['stale'], newLines: ['A'] }] },
        { operation: 'modify', path: 'b.txt', baseContent: 'two\n', hunks: [{ oldStart: 1, oldLines: ['two'], newLines: ['B'] }] },
      ],
    };

    await expect(service.apply(project.id, changeSet)).rejects.toMatchObject({ errors: [{ path: 'a.txt', code: 'BASE_MISMATCH' }] });
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('one\n');
    await expect(readFile(join(root, 'b.txt'), 'utf8')).resolves.toBe('two\n');
  });

  it('applies create and delete operations in one transaction', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
    await writeFile(join(root, 'remove.txt'), 'remove me\n');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const service = new ChangeSetService(projects, new FileService(projects));
    const changeSet: ChangeSet = {
      id: 'cs-3',
      description: 'replace file',
      changes: [
        { operation: 'create', path: 'new.txt', baseContent: null, content: 'new\n' },
        { operation: 'delete', path: 'remove.txt', baseContent: 'remove me\n' },
      ],
    };

    await expect(service.apply(project.id, changeSet)).resolves.toEqual({ id: 'cs-3', changedFiles: ['new.txt', 'remove.txt'] });
    await expect(readFile(join(root, 'new.txt'), 'utf8')).resolves.toBe('new\n');
    await expect(exists(join(root, 'remove.txt'))).resolves.toBe(false);
  });
});
