import type { ToolExecutionResult } from '../agents/tools/ToolExecutor.js';
import type { CommandPolicy } from '../security/SecurityPolicy.js';
import type { TaskCheckpoint, TaskRecord, TaskService } from './TaskService.js';

export interface TaskRunRequest {
  id: string;
  projectId: string;
  prompt?: string;
  checkpoint?: TaskCheckpoint;
}

export interface CommandTaskRunRequest extends TaskRunRequest {
  command: string;
  cwd: string;
  policy: CommandPolicy;
}

export interface TaskStatusEvent {
  taskId: string;
  status: TaskRecord['status'];
  timestamp: string;
  error?: string;
}

type TaskListener = (event: TaskStatusEvent) => void;
type TaskExecutor = (request: TaskRunRequest) => Promise<void>;
type TaskCommandExecutor = (request: CommandTaskRunRequest) => Promise<ToolExecutionResult>;

export class TaskRunner {
  private readonly listeners = new Set<TaskListener>();

  constructor(
    private readonly tasks: TaskService,
    private readonly execute: TaskExecutor,
    private readonly executeCommand?: TaskCommandExecutor,
  ) {}

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async submit(request: TaskRunRequest): Promise<TaskRecord> {
    return this.run(request, this.execute);
  }

  async submitCommand(request: CommandTaskRunRequest): Promise<TaskRecord> {
    if (!this.executeCommand) throw new Error('Secure command executor is not configured');
    return this.run(
      {
        ...request,
        checkpoint: {
          name: 'command.submitted',
          data: { command: request.command, cwd: request.cwd, policy: request.policy },
        },
      },
      async (task) => {
        await this.executeCommand!(request);
        void task;
      },
    );
  }

  get(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  list(): TaskRecord[] {
    return this.tasks.list();
  }

  private async run(request: TaskRunRequest, executor: TaskExecutor): Promise<TaskRecord> {
    const created = await this.tasks.create(request.id, request.projectId);
    this.emit(created);

    if (request.checkpoint) {
      await this.tasks.checkpoint(request.id, request.checkpoint);
    }

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
    const event: TaskStatusEvent = {
      taskId: task.id,
      status: task.status,
      timestamp: task.updatedAt,
      ...(task.error ? { error: task.error } : {}),
    };
    for (const listener of this.listeners) listener(event);
  }
}
