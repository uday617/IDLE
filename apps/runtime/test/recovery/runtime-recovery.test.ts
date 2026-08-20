import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RuntimeRecoveryService } from '../../src/recovery/RuntimeRecoveryService.js';
import { TaskService } from '../../src/tasks/TaskService.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('RuntimeRecoveryService', () => {
  it('resumes a running task from its persisted checkpoint after restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'idle-recovery-'));
    tempDirs.push(dir);
    const store = join(dir, 'tasks.json');

    const first = new TaskService(store);
    await first.load();
    await first.create('task-1');
    await first.start('task-1');
    await first.checkpoint('task-1', { name: 'apply-patch', data: { file: 'app.ts' } });

    const restarted = new TaskService(store);
    await restarted.load();
    const recovery = new RuntimeRecoveryService(restarted);
    let checkpointSeen: string | undefined;
    const resumed = await recovery.resumePendingTasksWith(async (task) => {
      checkpointSeen = task.checkpoint?.name;
    });

    expect(resumed).toEqual(['task-1']);
    expect(checkpointSeen).toBe('apply-patch');
    expect(restarted.get('task-1')?.status).toBe('running');
  });

  it('pauses a task when recovery cannot resume it safely', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'idle-recovery-'));
    tempDirs.push(dir);
    const store = join(dir, 'tasks.json');

    const service = new TaskService(store);
    await service.load();
    await service.create('task-2');
    await service.start('task-2');

    const recovery = new RuntimeRecoveryService(service);
    expect(await recovery.resumePendingTasks()).toEqual(['task-2']);
    expect(service.get('task-2')).toMatchObject({ status: 'paused' });
    expect(service.get('task-2')?.error).toContain('resume handler');
  });

  it('does not falsely complete a task when its resume handler fails', async () => {
    const service = new TaskService();
    await service.create('task-3');
    await service.start('task-3');

    const recovery = new RuntimeRecoveryService(service);
    expect(await recovery.resumePendingTasksWith(async () => {
      throw new Error('checkpoint is invalid');
    })).toEqual([]);

    expect(service.get('task-3')).toMatchObject({
      status: 'paused',
      error: 'checkpoint is invalid',
    });
  });
});
