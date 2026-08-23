import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeServer } from '../../src/ipc/server.js';

describe('multi-agent orchestration e2e', () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it('surfaces overlapping path ownership instead of aggregating', async () => {
    const root = await mkdtemp(join(process.env.TEMP ?? '/tmp', 'idle-multi-agent-conflict-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'shared.txt'), 'shared\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });

    await server.submitTask({
      taskId: 'multi-agent-conflict-1',
      projectId: project.id,
      prompt: [
        'SUBTASK 1: Replace line "shared" with "first" in file "shared.txt"',
        'PATHS: shared.txt',
        '',
        'SUBTASK 2: Replace line "shared" with "second" in file "shared.txt"',
        'PATHS: shared.txt',
      ].join('\n'),
      orchestration: { enabled: true, maxAgents: 2 },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(server.getTask('multi-agent-conflict-1')).resolves.toMatchObject({
      status: 'failed',
      error: expect.stringContaining('Multi-agent conflict'),
    });
    await server.stop();
  });

  it('keeps single-agent execution available through maxAgents=1', async () => {
    const root = await mkdtemp(join(process.env.TEMP ?? '/tmp', 'idle-multi-agent-single-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'single.txt'), 'before\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });

    await server.submitTask({
      taskId: 'multi-agent-single-1',
      projectId: project.id,
      prompt: 'SUBTASK 1: Replace line "before" with "after" in file "single.txt"\nPATHS: single.txt',
      orchestration: { enabled: true, maxAgents: 1 },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(server.getTask('multi-agent-single-1')).resolves.toMatchObject({
      status: 'completed',
      changeSet: { changes: [expect.objectContaining({ path: 'single.txt' })] },
    });
    await server.stop();
  });
});
