import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import { ChangeSetService } from '../../src/project/ChangeSetService.js';
import { FileService } from '../../src/project/FileService.js';
import { ProjectService } from '../../src/project/ProjectService.js';

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

function serviceFor(root: string) {
  const projects = new ProjectService();
  return projects.open(root).then((project) => ({ project, service: new ChangeSetService(projects, new FileService(projects)) }));
}

describe('ChangeSetService', () => {
  it('previews a modify without writing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
    await writeFile(join(root, 'a.txt'), 'one\n');
    const { project, service } = await serviceFor(root);
    const changeSet: ChangeSet = { id: 'preview-1', description: 'preview', changes: [
      { operation: 'modify', path: 'a.txt', baseContent: 'one\n', hunks: [{ oldStart: 1, oldLines: ['one'], newLines: ['ONE', 'again'] }] },
    ] };

    await expect(service.preview(project.id, changeSet)).resolves.toEqual({
      id: 'preview-1',
      files: [{ path: 'a.txt', operation: 'modify', oldContent: 'one\n', newContent: 'ONE\nagain\n', additions: 1, deletions: 0 }],
    });
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('one\n');
  });

  it('previews create and delete without mutating the project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
    await writeFile(join(root, 'remove.txt'), 'remove me\n');
    const { project, service } = await serviceFor(root);
    const changeSet: ChangeSet = { id: 'preview-2', description: 'preview create delete', changes: [
      { operation: 'create', path: 'new.txt', baseContent: null, content: 'new\n' },
      { operation: 'delete', path: 'remove.txt', baseContent: 'remove me\n' },
    ] };

    await expect(service.preview(project.id, changeSet)).resolves.toEqual({
      id: 'preview-2',
      files: [
        { path: 'new.txt', operation: 'create', oldContent: null, newContent: 'new\n', additions: 1, deletions: 0 },
        { path: 'remove.txt', operation: 'delete', oldContent: 'remove me\n', newContent: null, additions: 0, deletions: 1 },
      ],
    });
    await expect(exists(join(root, 'new.txt'))).resolves.toBe(false);
    await expect(readFile(join(root, 'remove.txt'), 'utf8')).resolves.toBe('remove me\n');
  });

  it('rejects stale previews before returning a diff', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-'));
    await writeFile(join(root, 'a.txt'), 'one\n');
    const { project, service } = await serviceFor(root);
    const changeSet: ChangeSet = { id: 'preview-3', description: 'stale', changes: [
      { operation: 'modify', path: 'a.txt', baseContent: 'stale\n', hunks: [{ oldStart: 1, oldLines: ['stale'], newLines: ['new'] }] },
    ] };

    await expect(service.preview(project.id, changeSet)).rejects.toMatchObject({ errors: [{ path: 'a.txt', code: 'BASE_MISMATCH' }] });
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('one\n');
  });

  it('reviews a valid changeset with a preview and does not mutate files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-review-'));
    await writeFile(join(root, 'a.txt'), 'one\n');
    const { project, service } = await serviceFor(root);
    const changeSet: ChangeSet = { id: 'review-1', description: 'review', changes: [
      { operation: 'modify', path: 'a.txt', baseContent: 'one\n', hunks: [{ oldStart: 1, oldLines: ['one'], newLines: ['ONE'] }] },
    ] };

    await expect(service.review(project.id, changeSet)).resolves.toMatchObject({
      id: 'review-1', valid: true, errors: [], preview: { id: 'review-1' },
    });
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('one\n');
  });

  it('returns validation errors for a stale changeset without mutating files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-change-set-review-'));
    await writeFile(join(root, 'a.txt'), 'one\n');
    const { project, service } = await serviceFor(root);
    const changeSet: ChangeSet = { id: 'review-2', description: 'stale review', changes: [
      { operation: 'modify', path: 'a.txt', baseContent: 'stale\n', hunks: [{ oldStart: 1, oldLines: ['stale'], newLines: ['new'] }] },
    ] };

    await expect(service.review(project.id, changeSet)).resolves.toMatchObject({
      id: 'review-2', valid: false, preview: null,
      errors: [{ path: 'a.txt', code: 'BASE_MISMATCH' }],
    });
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('one\n');
  });
});
