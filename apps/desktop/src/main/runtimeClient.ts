import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';

export interface Project { id: string; path: string; }
export interface FileEntry { name: string; path: string; kind: 'file' | 'directory'; }
export interface FileContent { path: string; content: string; }

type RuntimeResponse = Project | FileEntry[] | FileContent | TaskSubmitResult | TaskResult | null | { ok: true };
type TaskEventListener = (event: TaskStatusEvent) => void;
type PendingRequest = { resolve: (value: RuntimeResponse) => void; reject: (error: Error) => void };

export class RuntimeClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly taskListeners = new Set<TaskEventListener>();

  constructor(private readonly runtimePath: string, private readonly taskStorePath?: string) {}

  start(): void {
    if (this.process) return;
    const child = spawn(process.execPath, [this.runtimePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        ...(this.taskStorePath ? { IDLE_TASK_STORE_PATH: this.taskStorePath } : {}),
      },
    });
    this.process = child;
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        const message = JSON.parse(line) as { id?: number; error?: string; result?: RuntimeResponse; event?: string; payload?: TaskStatusEvent };
        if (message.event === 'task.status' && message.payload) { for (const listener of this.taskListeners) listener(message.payload); return; }
        if (typeof message.id !== 'number') return;
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error)); else request.resolve(message.result ?? null);
      } catch { /* Ignore malformed runtime output; stderr is reserved for diagnostics. */ }
    });
    child.on('error', (error) => console.error('[idle-runtime] process error', error));
    child.stderr.on('data', (chunk) => console.error(`[idle-runtime] ${chunk}`));
    child.on('exit', (code, signal) => {
      console.error(`[idle-runtime] exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
      this.process = null;
      for (const request of this.pending.values()) request.reject(new Error('Agent runtime stopped'));
      this.pending.clear();
    });
  }

  stop(): void { this.process?.kill(); this.process = null; }

  request(command: Record<string, unknown>): Promise<RuntimeResponse> {
    if (!this.process) throw new Error('Agent runtime is not started');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process?.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
    });
  }

  submitTask(request: TaskSubmitRequest): Promise<TaskSubmitResult> { return this.request({ type: 'task.submit', ...request }) as Promise<TaskSubmitResult>; }
  getTask(taskId: string): Promise<TaskResult | null> { return this.request({ type: 'task.get', taskId }) as Promise<TaskResult | null>; }
  subscribeTask(listener: TaskEventListener): () => void { this.taskListeners.add(listener); return () => this.taskListeners.delete(listener); }
}
