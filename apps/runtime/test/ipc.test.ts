import { mkdtemp, rm } from 'node:fs/promises';
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

  it('applies a changeset through the runtime boundary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-runtime-project-'));
    temporaryPaths.push(root);

    const server = createRuntimeServer('0.1.0');
    await server.start();

    const project = await server.handleProject({ type: 'project.open', path: root });
    const result = await server.handleProject({
      type: 'changeset.apply',
      projectId: project.id,
      changeSet: {
        id: 'ipc-change-1',
        description: 'create a file through IPC',
        changes: [
          {
            operation: 'create',
            path: 'hello.txt',
            baseContent: null,
            content: 'hello from ipc',
          },
        ],
      },
    });

    expect(result).toEqual({ id: 'ipc-change-1', changedFiles: ['hello.txt'] });
    await expect(server.handleProject({
      type: 'file.read',
      projectId: project.id,
      path: 'hello.txt',
    })).resolves.toEqual({ path: 'hello.txt', content: 'hello from ipc' });

    await server.stop();
  });
});
