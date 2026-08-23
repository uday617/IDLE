import type { ChangeSet, TaskOrchestrationRequest } from '@idle/contracts';
import type { ToolExecutionResult } from '../agents/tools/ToolExecutor.js';
import type { CommandPolicy } from '../security/SecurityPolicy.js';
import type { TaskCheckpoint, TaskRecord, TaskService } from './TaskService.js';

export interface TaskRunRequest {
  id: string;
  projectId: string;
  prompt?: string;
  checkpoint?: TaskCheckpoint;
  orchestration?: TaskOrchestrationRequest | undefined;
}

export interface CommandTaskRunRequest extends TaskRunRequest {
  command: string;
  cwd: string;
  policy: CommandPolicy;
}

type TaskListener = (event: TaskStatusEvent) => void;
export interface TaskStatusEvent {
  taskId: string;
  status: TaskRecord['status'];
  timestamp: string;
  error?: string;
}

type TaskExecutor = (request: TaskRunRequest) => Promise<void>;
type TaskMultiAgentExecutor = (request: TaskRunRequest) => Promise<ChangeSet>;
type TaskCommandExecutor = (request: CommandTaskRunRequest) => Promise<ToolExecutionResult>;

export class TaskRunner {
  private readonly listeners = new Set<TaskListener>();

  constructor(
    private readonly tasks: TaskService,
    private readonly execute: TaskExecutor,
    private readonly executeCommand?: TaskCommandExecutor,
    private readonly executeMultiAgent?: TaskMultiAgentExecutor,
  ) {}

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async submit(request: TaskRunRequest): Promise<TaskRecord> {
    if (request.orchestration?.enabled) {
      if (!this.executeMultiAgent) throw new Error('Multi-agent executor is not configured');
      return this.run(request, async (task) => {
        const changeSet = await this.executeMultiAgent!(task);
        await this.tasks.checkpoint(task.id, { name: 'agent.changeset', data: changeSet });
      });
    }
    return this.run(request, this.execute);
  }

  async submitCommand(request: CommandTaskRunRequest): Promise<TaskRecord> {
    if (!this.executeCommand) throw new Error('Secure command executor is not configured');
    return this.run(
      { ...request, checkpoint: { name: 'command.submitted', data: { command: request.command, cwd: request.cwd, policy: request.policy } } },
      async (task) => { await this.executeCommand!(request); void task; },
    );
  }

  async resumePendingTasks(): Promise<string[]> {
    const candidates = this.tasks.list().filter((task) => task.status === 'running' || task.status === 'pending');
    const resumed = await this.tasks.resumePendingTasks(async (task) => {
      if (!task.projectId || task.prompt === undefined) throw new Error('Task checkpoint does not contain a resumable submission');
      const submission = task.checkpoint?.data as { orchestration?: TaskOrchestrationRequest } | undefined;
      const request: TaskRunRequest = {
        id: task.id,
        projectId: task.projectId,
        prompt: task.prompt,
        ...(task.checkpoint ? { checkpoint: task.checkpoint } : {}),
        ...(submission?.orchestration ? { orchestration: submission.orchestration } : {}),
      };
      if (request.orchestration?.enabled && this.executeMultiAgent) {
        const changeSet = await this.executeMultiAgent(request);
        await this.tasks.checkpoint(task.id, { name: 'agent.changeset', data: changeSet });
        return;
      }
      await this.execute(request);
    });

    const resumedSet = new Set(resumed);
    for (const task of candidates) {
      const current = this.tasks.get(task.id);
      if (!current) continue;
      if (resumedSet.has(task.id)) {
        this.emit(current);
        const completed = await this.tasks.complete(task.id);
        this.emit(completed);
      } else if (current.status === 'paused') {
        this.emit(current);
      }
    }
    return resumed;
  }

  get(id: string): TaskRecord | undefined { return this.tasks.get(id); }
  list(): TaskRecord[] { return this.tasks.list(); }

  private async run(request: TaskRunRequest, executor: TaskExecutor): Promise<TaskRecord> {
    const created = await this.tasks.create(request.id, request.projectId, request.prompt);
    this.emit(created);
    if (request.checkpoint) await this.tasks.checkpoint(request.id, request.checkpoint);
    const running = await this.tasks.start(request.id);
    this.emit(running);
    try {
      await executor(request);
      const completed = await this.tasks.complete(request.id);
      this.emit(completed);
      return completed;
    } catch (error) {
      const failed = await this.tasks.fail(request.id, error instanceof Error ? error : String(error));
      this.emit(failed);
      return failed;
    }
  }

  private emit(task: TaskRecord): void {
    const event: TaskStatusEvent = { taskId: task.id, status: task.status, timestamp: task.updatedAt, ...(task.error ? { error: task.error } : {}) };
    for (const listener of this.listeners) listener(event);
  }
}
