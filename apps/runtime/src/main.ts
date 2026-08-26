import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RUNTIME_VERSION } from './index.js';
import { createRuntimeServer } from './ipc/server.js';
import type { AgentProposalFile } from './agents/AgentProposalEngine.js';
import type { FailureContext, ProjectId, TaskId, TaskOrchestrationRequest, TaskStatusEvent, TaskSubmitRequest } from '@idle/contracts';
import type { ProjectCommand } from './project/ProjectController.js';

process.env.IDLE_PROJECT_STORE_PATH ??= join(homedir(), '.idle', 'projects.json');
const taskStorePath = process.env.IDLE_TASK_STORE_PATH;
const server = createRuntimeServer(RUNTIME_VERSION, taskStorePath === undefined ? {} : { taskStorePath });
await server.start();

interface RuntimeRequest {
  id: number;
  type: 'health' | 'project.open' | 'project.get' | 'project.close' | 'file.list' | 'file.read' | 'file.write' | 'changeset.review' | 'changeset.preview' | 'changeset.apply' | 'git.status' | 'git.diff' | 'terminal.run' | 'task.submit' | 'task.get' | 'task.repair' | 'task.repair.apply';
  path?: string;
  projectId?: string;
  taskId?: string;
  prompt?: string;
  content?: string;
  command?: string;
  changeSet?: Parameters<Extract<ProjectCommand, { type: 'changeset.review' }>['changeSet']>;
  orchestration?: TaskOrchestrationRequest;
  failure?: FailureContext;
  files?: readonly AgentProposalFile[];
  changeSetId?: string;
}

const lines = createInterface({ input: process.stdin });
server.subscribeTask((event: TaskStatusEvent) => process.stdout.write(`${JSON.stringify({ event: 'task.status', payload: event })}\n`));

lines.on('line', async (line) => {
  let request: RuntimeRequest | null = null;
  try {
    request = JSON.parse(line) as RuntimeRequest;
    let result: unknown;
    if (request.type === 'health') result = server.health();
    else if (request.type === 'task.submit') {
      const taskRequest: TaskSubmitRequest = { taskId: request.taskId as TaskId, projectId: request.projectId as ProjectId, prompt: request.prompt ?? '', ...(request.orchestration ? { orchestration: request.orchestration } : {}) };
      result = await server.submitTask(taskRequest);
    } else if (request.type === 'task.get') result = await server.getTask(request.taskId ?? '');
    else if (request.type === 'task.repair') {
      if (!request.taskId || !request.failure) throw new Error('task.repair requires taskId and failure');
      result = await server.repairTask(request.taskId, request.failure, request.files ?? []);
    } else if (request.type === 'task.repair.apply') {
      if (!request.taskId || !request.changeSetId) throw new Error('task.repair.apply requires taskId and changeSetId');
      result = await server.applyRepair(request.taskId, request.changeSetId);
    } else {
      const command = request.type === 'project.open'
        ? { type: 'project.open', path: request.path ?? '' }
        : request.type === 'project.get'
          ? { type: 'project.get', projectId: request.projectId ?? '' }
          : request.type === 'project.close'
            ? { type: 'project.close', projectId: request.projectId ?? '' }
            : request.type === 'file.list'
              ? { type: 'file.list', projectId: request.projectId ?? '', path: request.path ?? '.' }
              : request.type === 'file.read'
                ? { type: 'file.read', projectId: request.projectId ?? '', path: request.path ?? '' }
                : request.type === 'file.write'
                  ? { type: 'file.write', projectId: request.projectId ?? '', path: request.path ?? '', content: request.content ?? '' }
                  : request.type === 'changeset.review'
                    ? { type: 'changeset.review', projectId: request.projectId ?? '', changeSet: request.changeSet as never }
                    : request.type === 'changeset.preview'
                      ? { type: 'changeset.preview', projectId: request.projectId ?? '', changeSet: request.changeSet as never }
                      : request.type === 'changeset.apply'
                        ? { type: 'changeset.apply', projectId: request.projectId ?? '', changeSet: request.changeSet as never }
                        : request.type === 'git.status'
                          ? { type: 'git.status', projectId: request.projectId ?? '' }
                          : request.type === 'git.diff'
                            ? { type: 'git.diff', projectId: request.projectId ?? '' }
                            : { type: 'terminal.run', projectId: request.projectId ?? '', command: request.command ?? '' };
      result = await server.handleProject(command as ProjectCommand);
    }
    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    process.stdout.write(`${JSON.stringify({ id: request?.id ?? -1, error: message })}\n`);
  }
});

const shutdown = () => { lines.close(); void server.stop().finally(() => process.exit(0)); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
