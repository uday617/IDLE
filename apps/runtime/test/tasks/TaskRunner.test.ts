import { describe, expect, it, vi } from 'vitest';
import { TaskRunner } from '../../src/tasks/TaskRunner.js';
import { TaskService } from '../../src/tasks/TaskService.js';

describe('TaskRunner', () => {
  it('creates, runs, checkpoints, and completes a task', async () => {
    const service = new TaskService();
    const execute = vi.fn(async () => undefined);
    const runner = new TaskRunner(service, execute);
    const events: string[] = [];
    runner.subscribe((event) => events.push(event.status));

    const task = await runner.submit({ id: 'task-1', checkpoint: { name: 'planning' } });

    expect(task.status).toBe('completed');
    expect(execute).toHaveBeenCalledWith({ id: 'task-1', checkpoint: { name: 'planning' } });
    expect(service.get('task-1')?.status).toBe('completed');
    expect(events).toEqual(['pending', 'running', 'completed']);
  });

  it('marks a task failed when execution throws', async () => {
    const service = new TaskService();
    const runner = new TaskRunner(service, async () => {
      throw new Error('execution failed');
    });

    const result = await runner.submit({ id: 'task-2' });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('execution failed');
  });

  it('returns persisted task records by id', async () => {
    const service = new TaskService();
    const runner = new TaskRunner(service, async () => undefined);
    await runner.submit({ id: 'task-3' });

    expect(runner.get('task-3')?.status).toBe('completed');
    expect(runner.get('missing')).toBeUndefined();
  });

  it('runs command tasks through the injected secure executor', async () => {
    const service = new TaskService();
    const execute = vi.fn(async () => undefined);
    const executeCommand = vi.fn(async () => ({ stdout: 'status', stderr: '' }));
    const runner = new TaskRunner(service, execute, executeCommand);

    const result = await runner.submitCommand({
      id: 'task-command-1',
      projectId: 'project-1',
      command: 'git status',
      cwd: '/workspace/project',
      policy: { allowedCommands: ['git'] },
    });

    expect(result.status).toBe('completed');
    expect(executeCommand).toHaveBeenCalledWith({
      id: 'task-command-1',
      projectId: 'project-1',
      command: 'git status',
      cwd: '/workspace/project',
      policy: { allowedCommands: ['git'] },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails command tasks when the secure executor rejects a blocked command', async () => {
    const service = new TaskService();
    const executeCommand = vi.fn(async () => {
      throw new Error('Destructive command is blocked');
    });
    const runner = new TaskRunner(service, async () => undefined, executeCommand);

    const result = await runner.submitCommand({
      id: 'task-command-2',
      projectId: 'project-1',
      command: 'rm -rf .',
      cwd: '/workspace/project',
      policy: { allowedCommands: ['git', 'node'] },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Destructive command is blocked');
    expect(executeCommand).toHaveBeenCalledTimes(1);
  });
});
