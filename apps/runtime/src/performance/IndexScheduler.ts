export interface IndexChange {
  projectId: string;
  paths: readonly string[];
}

export type Indexer = (
  projectId: string,
  paths: readonly string[],
  signal: AbortSignal,
) => Promise<void>;

export interface IndexSchedulerOptions {
  debounceMs?: number;
}

interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface Batch {
  controller: AbortController;
  waiters: Waiter[];
}

interface ProjectState {
  pendingPaths: Set<string>;
  pendingWaiters: Waiter[];
  timer?: ReturnType<typeof setTimeout>;
  activeBatch?: Batch;
}

export class IndexScheduler {
  private readonly states = new Map<string, ProjectState>();
  private readonly debounceMs: number;

  constructor(
    private readonly index: Indexer,
    options: IndexSchedulerOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 25;
    if (!Number.isInteger(this.debounceMs) || this.debounceMs < 0) {
      throw new Error('debounceMs must be a non-negative integer');
    }
  }

  schedule(change: IndexChange): Promise<void> {
    if (!change.projectId) throw new Error('projectId is required');
    if (change.paths.length === 0) return Promise.resolve();

    const state = this.states.get(change.projectId) ?? {
      pendingPaths: new Set<string>(),
      pendingWaiters: [],
    };
    this.states.set(change.projectId, state);

    if (state.activeBatch) {
      state.activeBatch.controller.abort();
      this.rejectWaiters(state.activeBatch.waiters, new Error('aborted'));
      state.activeBatch = undefined;
    }

    for (const path of change.paths) {
      if (path) state.pendingPaths.add(path);
    }

    const promise = new Promise<void>((resolve, reject) => {
      state.pendingWaiters.push({ resolve, reject });
    });

    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = undefined;
      void this.run(change.projectId);
    }, this.debounceMs);

    return promise;
  }

  async flush(projectId: string): Promise<void> {
    const state = this.states.get(projectId);
    if (!state) return;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    if (state.pendingPaths.size === 0) return;
    await this.run(projectId);
  }

  private async run(projectId: string): Promise<void> {
    const state = this.states.get(projectId);
    if (!state || state.pendingPaths.size === 0) return;

    const paths = [...state.pendingPaths];
    const waiters = state.pendingWaiters.splice(0);
    state.pendingPaths.clear();
    const batch: Batch = { controller: new AbortController(), waiters };
    state.activeBatch = batch;

    try {
      await this.index(projectId, paths, batch.controller.signal);
      if (batch.controller.signal.aborted) throw new Error('aborted');
      this.resolveWaiters(batch.waiters);
    } catch (error) {
      this.rejectWaiters(batch.waiters, error);
    } finally {
      if (state.activeBatch === batch) state.activeBatch = undefined;
      if (state.pendingPaths.size > 0 && !state.timer) {
        state.timer = setTimeout(() => {
          state.timer = undefined;
          void this.run(projectId);
        }, this.debounceMs);
      }
      if (state.pendingPaths.size === 0 && !state.activeBatch && !state.timer) {
        this.states.delete(projectId);
      }
    }
  }

  private resolveWaiters(waiters: Waiter[]): void {
    for (const waiter of waiters) waiter.resolve();
  }

  private rejectWaiters(waiters: Waiter[], error: unknown): void {
    for (const waiter of waiters) waiter.reject(error);
  }
}
