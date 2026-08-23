import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeServer } from '../../src/ipc/server.js';

async function waitForTask(server: ReturnType<typeof createRuntimeServer>, taskId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await server.getTask(taskId);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Task did not reach a terminal state: ${taskId}`);
}

describe('multi-agent runtime integration', () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it('submits two independent agents and returns one combined ChangeSet', async () => {
    const root = await mkdtemp(join(process.env.TEMP ?? '/tmp', 'idle-multi-agent-'));
    temporaryPaths.push(root);
    await writeFile(join(root, 'a.txt'), 'alpha\n');
    await writeFile(join(root, 'b.txt'), 'beta\n');

    const server = createRuntimeServer('0.1.0');
    await server.start();
    const project = await server.handleProject({ type: 'project.open', path: root });

    await expect(server.submitTask({
      taskId: 'multi-agent-runtime-1',
      projectId: project.id,
      prompt: [
        'SUBTASK 1: Replace line "alpha" with "alpha updated" in file "a.txt"',
        'PATHS: a.txt',
        '',
        'SUBTASK 2: Replace line "beta" with "beta updated" in file "b.txt"',
        'PATHS: b.txt',
      ].join('\n'),
      orchestration: { enabled: true, maxAgents: 2 },
    })).resolves.toEqual({ taskId: 'multi-agent-runtime-1', status: 'queued' });

    await expect(waitForTask(server, 'multi-agent-runtime-1')).resolves.toMatchObject({
      taskId: 'multi-agent-runtime-1',
      status: 'completed',
      changeSet: {
        changes: [
          expect.objectContaining({ path: 'a.txt' }),
          expect.objectContaining({ path: 'b.txt' }),
        ],
      },
    });

    await server.stop();
  });
});
