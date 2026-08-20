import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeServer } from '../src/ipc/server.js';

describe('runtime server', () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it('reports health after startup', async () => {
    const server = createRuntimeServer('0.1.0');
    await server.start();
    expect(server.health()).toEqual({ status: 'ok', version: '0.1.0' });
    await server.stop();
  });

  it('handles project commands through the runtime boundary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-runtime-project-'));
    temporaryPaths.push(root);
    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });
    expect(project).toMatchObject({ path: root });
    expect(await server.handleProject({ type: 'project.close', projectId: project.id })).toEqual({ ok: true });
    await server.stop();
  });

  it('previews a changeset without writing through the runtime boundary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-runtime-project-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'hello.txt'), 'hello\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });
    const result = await server.handleProject({
      type: 'changeset.preview',
      projectId: project.id,
      changeSet: {
        id: 'ipc-preview-1', description: 'preview update',
        changes: [{ operation: 'modify', path: 'hello.txt', baseContent: 'hello\n', hunks: [{ oldStart: 1, oldLines: ['hello'], newLines: ['hello world'] }] }],
      },
    });

    expect(result).toEqual({ id: 'ipc-preview-1', files: [{ path: 'hello.txt', operation: 'modify', oldContent: 'hello\n', newContent: 'hello world\n', additions: 0, deletions: 0 }] });
    await expect(readFile(join(root, 'hello.txt'), 'utf8')).resolves.toBe('hello\n');
    await server.stop();
  });

  it('runs the complete preview-to-apply flow through IPC', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-runtime-project-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'hello.txt'), 'hello\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });
    const changeSet = {
      id: 'ipc-e2e-1', description: 'preview then apply',
      changes: [{ operation: 'modify', path: 'hello.txt', baseContent: 'hello\n', hunks: [{ oldStart: 1, oldLines: ['hello'], newLines: ['hello world'] }] }],
    };

    await expect(server.handleProject({ type: 'changeset.preview', projectId: project.id, changeSet })).resolves.toEqual({
      id: 'ipc-e2e-1', files: [{ path: 'hello.txt', operation: 'modify', oldContent: 'hello\n', newContent: 'hello world\n', additions: 0, deletions: 0 }],
    });
    await expect(readFile(join(root, 'hello.txt'), 'utf8')).resolves.toBe('hello\n');

    await expect(server.handleProject({ type: 'changeset.apply', projectId: project.id, changeSet })).resolves.toEqual({ id: 'ipc-e2e-1', changedFiles: ['hello.txt'] });
    await expect(readFile(join(root, 'hello.txt'), 'utf8')).resolves.toBe('hello world\n');
    await server.stop();
  });

  it('rejects applying a changeset after the previewed file becomes stale', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-runtime-project-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'hello.txt'), 'hello\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });
    const changeSet = {
      id: 'ipc-stale-1', description: 'stale preview',
      changes: [{ operation: 'modify', path: 'hello.txt', baseContent: 'hello\n', hunks: [{ oldStart: 1, oldLines: ['hello'], newLines: ['hello world'] }] }],
    };

    await server.handleProject({ type: 'changeset.preview', projectId: project.id, changeSet });
    await writeFile(join(root, 'hello.txt'), 'changed elsewhere\n');
    await expect(server.handleProject({ type: 'changeset.apply', projectId: project.id, changeSet })).rejects.toThrow();
    await expect(readFile(join(root, 'hello.txt'), 'utf8')).resolves.toBe('changed elsewhere\n');
    await server.stop();
  });

  it('applies create and delete operations and verifies final filesystem state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-runtime-project-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'remove.txt'), 'remove me\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });
    const changeSet = {
      id: 'ipc-create-delete-1', description: 'create and delete',
      changes: [
        { operation: 'create', path: 'new.txt', baseContent: null, content: 'new file\n' },
        { operation: 'delete', path: 'remove.txt', baseContent: 'remove me\n' },
      ],
    };

    await expect(server.handleProject({ type: 'changeset.preview', projectId: project.id, changeSet })).resolves.toMatchObject({ id: 'ipc-create-delete-1' });
    await expect(server.handleProject({ type: 'changeset.apply', projectId: project.id, changeSet })).resolves.toEqual({ id: 'ipc-create-delete-1', changedFiles: ['new.txt', 'remove.txt'] });
    await expect(readFile(join(root, 'new.txt'), 'utf8')).resolves.toBe('new file\n');
    await expect(stat(join(root, 'remove.txt'))).rejects.toThrow();
    await server.stop();
  });
});
