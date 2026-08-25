import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectService } from '../project/ProjectService.js';
import { TaskRunner } from './TaskRunner.js';
import { TaskService } from './TaskService.js';

describe('TaskRunner restart recovery', () => {
  it('resumes a running task after restart without losing project identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-recovery-project-'));
    const storeDir = await mkdtemp(join(tmpdir(), 'idle-recovery-store-'));
    const taskStore = join(storeDir, 'tasks.json');
    const projectStore = join(storeDir, 'projects.json');

    const projects = new ProjectService(projectStore);
    const project = await projects.open(root);
    const tasks = new TaskService(taskStore);
    await tasks.create('task-1', project.id, 'resume me');
    await tasks.checkpoint('task-1', { name: 'agent.plan', data: { step: 'resume' } });
    await tasks.start('task-1');

    const restartedProjects = new ProjectService(projectStore);
    const restartedTasks = new TaskService(taskStore);
    await restartedProjects.load();
    await restartedTasks.load();

    const runner = new TaskRunner(restartedTasks, async (request) => {
      await expect(restartedProjects.get(request.projectId)).resolves.toEqual(project);
      await restartedTasks.checkpoint(request.id, { name: 'agent.resumed', data: { ok: true } });
    });

    await expect(runner.resumePendingTasks()).resolves.toEqual(['task-1']);
    await expect(restartedTasks.get('task-1')).resolves;
    expect(restartedTasks.get('task-1')?.status).toBe('completed');
    expect(restartedTasks.get('task-1')?.checkpoint?.name).toBe('agent.resumed');
  });
});
