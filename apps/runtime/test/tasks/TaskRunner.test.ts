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

  it('records the completed task outcome without changing task behavior', async () => {
    const service = new TaskService();
    const recorder = { record: vi.fn(async () => undefined) };
    const runner = new TaskRunner(service, async () => undefined, undefined, undefined, recorder);

    const result = await runner.submit({ id: 'task-memory-1', projectId: 'project-1', prompt: 'Fix parser' });

    expect(result.status).toBe('completed');
    expect(recorder.record).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-memory-1',
      projectId: 'project-1',
      status: 'completed',
      prompt: 'Fix parser',
    }));
  });

  it('does not fail a task when memory recording fails', async () => {
    const service = new TaskService();
    const recorder = { record: vi.fn(async () => { throw new Error('memory unavailable'); }) };
    const runner = new TaskRunner(service, async () => undefined, undefined, undefined, recorder);

    const result = await runner.submit({ id: 'task-memory-2', projectId: 'project-1', prompt: 'Run tests' });

    expect(result.status).toBe('completed');
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

  it('resumes persisted pending and running tasks through the task executor', async () => {
    const service = new TaskService();
    await service.create('task-pending', 'project-1', 'inspect the project');
    await service.checkpoint('task-pending', { name: 'submitted', data: { projectId: 'project-1', prompt: 'inspect the project' } });
    await service.create('task-running', 'project-1', 'run the task again');
    await service.start('task-running');
    await service.checkpoint('task-running', { name: 'submitted', data: { projectId: 'project-1', prompt: 'run the task again' } });

    const execute = vi.fn(async () => undefined);
    const runner = new TaskRunner(service, execute);
    const events: string[] = [];
    runner.subscribe((event) => events.push(`${event.taskId}:${event.status}`));

    const resumed = await runner.resumePendingTasks();

    expect(resumed).toEqual(['task-pending', 'task-running']);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledWith({ id: 'task-pending', projectId: 'project-1', prompt: 'inspect the project', checkpoint: { name: 'submitted', data: { projectId: 'project-1', prompt: 'inspect the project' } } });
    expect(service.get('task-pending')?.status).toBe('completed');
    expect(service.get('task-running')?.status).toBe('completed');
    expect(events).toEqual(['task-pending:running', 'task-pending:completed', 'task-running:running', 'task-running:completed']);
  });

  it('pauses a persisted task when its checkpoint cannot reconstruct a run request', async () => {
    const service = new TaskService();
    await service.create('task-invalid', 'project-1');
    await service.start('task-invalid');
    await service.checkpoint('task-invalid', { name: 'agent.plan', data: { plan: 'missing submitted request' } });

    const runner = new TaskRunner(service, vi.fn(async () => undefined));
    const resumed = await runner.resumePendingTasks();

    expect(resumed).toEqual([]);
    expect(runner.get('task-invalid')).toMatchObject({ status: 'paused', error: 'Task checkpoint does not contain a resumable submission' });
  });
});
