import type { TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
import {
  ProjectController,
  type ProjectCommand,
  type ProjectCommandResult,
} from '../project/ProjectController.js';
import { ChangeSetService } from '../project/ChangeSetService.js';
import { FileService } from '../project/FileService.js';
import { ProjectService } from '../project/ProjectService.js';

export interface RuntimeHealth {
  status: 'ok';
  version: string;
}

export interface RuntimeServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): RuntimeHealth;
  handleProject(command: ProjectCommand): Promise<ProjectCommandResult>;
  submitTask(request: TaskSubmitRequest): Promise<TaskSubmitResult>;
  getTask(taskId: string): Promise<TaskResult | null>;
  subscribeTask(listener: (event: TaskStatusEvent) => void): () => void;
}

export function createRuntimeServer(version: string): RuntimeServer {
  let started = false;
  const projectService = new ProjectService();
  const fileService = new FileService(projectService);
  const changeSetService = new ChangeSetService(projectService, fileService);
  const projectController = new ProjectController(projectService, fileService, changeSetService);
  const taskListeners = new Set<(event: TaskStatusEvent) => void>();
  const tasks = new Map<string, TaskResult>();

  return {
    async start() {
      started = true;
    },
    async stop() {
      started = false;
      taskListeners.clear();
    },
    health() {
      if (!started) throw new Error('Runtime is not started');
      return { status: 'ok', version };
    },
    async handleProject(command) {
      if (!started) throw new Error('Runtime is not started');
      return projectController.handle(command);
    },
    async submitTask(request) {
      if (!started) throw new Error('Runtime is not started');
      const result: TaskSubmitResult = { taskId: request.taskId, status: 'pending' };
      const task: TaskResult = { taskId: request.taskId, status: 'paused', error: 'Execution provider is not connected yet' };
      tasks.set(request.taskId, task);
      const event: TaskStatusEvent = {
        taskId: request.taskId,
        status: 'paused',
        timestamp: new Date().toISOString(),
        message: task.error,
      };
      for (const listener of taskListeners) listener(event);
      return result;
    },
    async getTask(taskId) {
      if (!started) throw new Error('Runtime is not started');
      return tasks.get(taskId) ?? null;
    },
    subscribeTask(listener) {
      taskListeners.add(listener);
      return () => taskListeners.delete(listener);
    },
  };
}
