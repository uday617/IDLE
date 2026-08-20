import { createInterface } from 'node:readline';
import { RUNTIME_VERSION } from './index.js';
import { createRuntimeServer } from './ipc/server.js';
import type { ProjectCommand } from './project/ProjectController.js';
import type { TaskStatusEvent, TaskSubmitRequest } from '@idle/contracts';

const server = createRuntimeServer(RUNTIME_VERSION);
await server.start();

interface RuntimeRequest {
  id: number;
  type:
    | 'health'
    | 'project.open'
    | 'project.get'
    | 'project.close'
    | 'file.list'
    | 'file.read'
    | 'task.submit'
    | 'task.get';
  path?: string;
  projectId?: string;
  taskId?: string;
  prompt?: string;
}

const lines = createInterface({ input: process.stdin });
server.subscribeTask((event: TaskStatusEvent) => {
  process.stdout.write(`${JSON.stringify({ event: 'task.status', payload: event })}\n`);
});

lines.on('line', async (line) => {
  let request: RuntimeRequest | null = null;
  try {
    request = JSON.parse(line) as RuntimeRequest;
    let result: unknown;

    if (request.type === 'health') {
      result = server.health();
    } else if (request.type === 'task.submit') {
      const taskRequest: TaskSubmitRequest = {
        taskId: request.taskId ?? '',
        projectId: request.projectId ?? '',
        prompt: request.prompt ?? '',
      };
      result = await server.submitTask(taskRequest);
    } else if (request.type === 'task.get') {
      result = await server.getTask(request.taskId ?? '');
    } else {
      const command: ProjectCommand =
        request.type === 'project.open'
          ? { type: 'project.open', path: request.path ?? '' }
          : request.type === 'project.get'
            ? { type: 'project.get', projectId: request.projectId ?? '' }
            : request.type === 'project.close'
              ? { type: 'project.close', projectId: request.projectId ?? '' }
              : request.type === 'file.list'
                ? { type: 'file.list', projectId: request.projectId ?? '', path: request.path ?? '.' }
                : { type: 'file.read', projectId: request.projectId ?? '', path: request.path ?? '' };
      result = await server.handleProject(command);
    }

    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    process.stdout.write(`${JSON.stringify({ id: request?.id ?? -1, error: message })}\n`);
  }
});

const shutdown = () => {
  lines.close();
  void server.stop().finally(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
