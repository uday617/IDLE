import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FailureContext } from '@idle/contracts';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type PersistedRepairStatus = 'verifying' | 'repair_pending' | 'review' | 'completed' | 'failed';

export interface TaskCheckpoint {
  name: string;
  data?: unknown;
}

export interface TaskRecord {
  id: string;
  projectId?: string;
  prompt?: string;
  status: TaskStatus;
  checkpoint?: TaskCheckpoint;
  repairAttempts: number;
  repairStatus: PersistedRepairStatus;
  latestFailure?: FailureContext;
  updatedAt: string;
  error?: string;
}

interface TaskStore {
  tasks: Record<string, TaskRecord>;
}

export class TaskService {
  private readonly tasks = new Map<string, TaskRecord>();

  constructor(private readonly storePath?: string) {}

  async load(): Promise<void> {
    if (!this.storePath) return;
    try {
      const raw = await readFile(this.storePath, 'utf8');
      const store = JSON.parse(raw) as TaskStore;
      this.tasks.clear();
      for (const task of Object.values(store.tasks ?? {})) {
        this.tasks.set(task.id, {
          ...task,
          repairAttempts: task.repairAttempts ?? 0,
          repairStatus: task.repairStatus ?? 'verifying',
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async create(id: string, projectId?: string, prompt?: string): Promise<TaskRecord> {
    const task: TaskRecord = {
      id,
      ...(projectId ? { projectId } : {}),
      ...(prompt !== undefined ? { prompt } : {}),
      status: 'pending',
      repairAttempts: 0,
      repairStatus: 'verifying',
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, task);
    await this.persist();
    return task;
  }

  async start(id: string): Promise<TaskRecord> { return this.update(id, { status: 'running' }); }

  async checkpoint(id: string, checkpoint: TaskCheckpoint): Promise<TaskRecord> {
    const current = this.tasks.get(id);
    if (!current) throw new Error(`Unknown task: ${id}`);

    // Keep the reviewable ChangeSet as the primary task checkpoint. Verification
    // is metadata about that artifact and must not hide it from task.get().
    if (checkpoint.name === 'agent.verification' && current.checkpoint?.name === 'agent.changeset') {
      const data = current.checkpoint.data && typeof current.checkpoint.data === 'object'
        ? { ...(current.checkpoint.data as Record<string, unknown>), verification: checkpoint.data }
        : { verification: checkpoint.data };
      return this.update(id, { checkpoint: { name: 'agent.changeset', data } });
    }

    return this.update(id, { checkpoint });
  }

  async recordRepairFailure(id: string, failure: FailureContext): Promise<TaskRecord> {
    const current = this.tasks.get(id);
    if (!current) throw new Error(`Unknown task: ${id}`);
    if (failure.attempt < 1 || failure.attempt > 3) throw new Error(`Invalid repair attempt: ${failure.attempt}`);
    return this.update(id, {
      repairAttempts: failure.attempt,
      repairStatus: 'repair_pending',
      latestFailure: failure,
    });
  }

  async markRepairReview(id: string): Promise<TaskRecord> {
    return this.update(id, { repairStatus: 'review' });
  }

  async complete(id: string): Promise<TaskRecord> {
    return this.update(id, { status: 'completed', repairStatus: 'completed' });
  }

  async fail(id: string, error: Error | string): Promise<TaskRecord> {
    return this.update(id, { status: 'failed', repairStatus: 'failed', error: error instanceof Error ? error.message : error });
  }

  async pause(id: string, error?: string): Promise<TaskRecord> {
    return error === undefined ? this.update(id, { status: 'paused' }) : this.update(id, { status: 'paused', error });
  }

  get(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : undefined;
  }

  list(): TaskRecord[] { return [...this.tasks.values()].map((task) => structuredClone(task)); }

  async resumePendingTasks(resume?: (task: TaskRecord) => Promise<void>): Promise<string[]> {
    const resumable = [...this.tasks.values()].filter((task) => task.status === 'running' || task.status === 'pending');
    const resumed: string[] = [];
    for (const task of resumable) {
      if (resume) {
        try {
          await resume(structuredClone(task));
          await this.start(task.id);
        } catch (error) {
          await this.pause(task.id, error instanceof Error ? error.message : String(error));
          continue;
        }
      } else {
        await this.pause(task.id, 'Runtime restarted before a resume handler was registered');
      }
      resumed.push(task.id);
    }
    return resumed;
  }

  private async update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord> {
    const current = this.tasks.get(id);
    if (!current) throw new Error(`Unknown task: ${id}`);
    const next: TaskRecord = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.tasks.set(id, next);
    await this.persist();
    return structuredClone(next);
  }

  private async persist(): Promise<void> {
    if (!this.storePath) return;
    await mkdir(dirname(this.storePath), { recursive: true });
    const store: TaskStore = { tasks: Object.fromEntries(this.tasks) };
    await writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf8');
  }
}
