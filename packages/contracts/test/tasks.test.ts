import { describe, expect, it } from 'vitest';
import type {
  ProjectId,
  TaskId,
  TaskResult,
  TaskStatusEvent,
  TaskSubmitRequest,
  TaskSubmitResult,
} from '../src/index.js';

describe('task execution contracts', () => {
  it('models a task submission request', () => {
    const request: TaskSubmitRequest = {
      taskId: 'task-1' as TaskId,
      projectId: 'project-1' as ProjectId,
      prompt: 'Fix the failing tests',
    };

    expect(request.prompt).toBe('Fix the failing tests');
  });

  it('models task submission and status events', () => {
    const submitted: TaskSubmitResult = {
      taskId: 'task-1' as TaskId,
      status: 'queued',
    };
    const event: TaskStatusEvent = {
      taskId: submitted.taskId,
      status: 'running',
      timestamp: new Date().toISOString(),
      message: 'Executing task',
    };

    expect(event.taskId).toBe(submitted.taskId);
    expect(event.status).toBe('running');
  });

  it('models completed and failed task results', () => {
    const completed: TaskResult = {
      taskId: 'task-1' as TaskId,
      status: 'completed',
      summary: 'Tests fixed',
      changeSetId: 'change-1',
    };
    const failed: TaskResult = {
      taskId: 'task-2' as TaskId,
      status: 'failed',
      error: 'Tool execution failed',
    };

    expect(completed.changeSetId).toBe('change-1');
    expect(failed.error).toBe('Tool execution failed');
  });
});
