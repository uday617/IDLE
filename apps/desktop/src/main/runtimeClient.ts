import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface Project {
  id: string;
  path: string;
}

type ProjectResponse = Project | null | { ok: true };

type PendingRequest = {
  resolve: (value: ProjectResponse) => void;
  reject: (error: Error) => void;
};

export class RuntimeClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(private readonly runtimePath: string) {}

  start(): void {
    if (this.process) return;

    const child = spawn(process.execPath, [this.runtimePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.process = child;

    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        const message = JSON.parse(line) as { id?: number; error?: string; result?: ProjectResponse };
        if (typeof message.id !== 'number') return;
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error));
        else request.resolve(message.result ?? null);
      } catch {
        // Ignore malformed runtime output; stderr is reserved for diagnostics.
      }
    });

    child.on('exit', () => {
      this.process = null;
      for (const request of this.pending.values()) {
        request.reject(new Error('Agent runtime stopped'));
      }
      this.pending.clear();
    });
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }

  request(command: Record<string, unknown>): Promise<ProjectResponse> {
    if (!this.process) throw new Error('Agent runtime is not started');
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process?.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
    });
  }
}
