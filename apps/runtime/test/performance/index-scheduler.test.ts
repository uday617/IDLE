import { describe, expect, it, vi } from 'vitest';
import { IndexScheduler } from '../../src/performance/IndexScheduler.js';

describe('IndexScheduler', () => {
  it('batches rapid changes for the same project into one indexing job', async () => {
    const index = vi.fn().mockResolvedValue(undefined);
    const scheduler = new IndexScheduler(index, { debounceMs: 5 });

    await Promise.all([
      scheduler.schedule({ projectId: 'project-1', paths: ['src/a.ts'] }),
      scheduler.schedule({ projectId: 'project-1', paths: ['src/b.ts', 'src/a.ts'] }),
    ]);

    expect(index).toHaveBeenCalledTimes(1);
    expect(index).toHaveBeenCalledWith(
      'project-1',
      ['src/a.ts', 'src/b.ts'],
      expect.any(AbortSignal),
    );
  });

  it('cancels an obsolete in-flight indexing job when newer changes arrive', async () => {
    const aborted: AbortSignal[] = [];
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const index = vi.fn(async (_projectId: string, _paths: readonly string[], signal: AbortSignal) => {
      aborted.push(signal);
      if (aborted.length === 1) await firstStarted;
      if (signal.aborted) throw new Error('aborted');
    });

    const scheduler = new IndexScheduler(index, { debounceMs: 0 });
    const first = scheduler.schedule({ projectId: 'project-1', paths: ['src/a.ts'] });
    const flushFirst = scheduler.flush('project-1');
    await Promise.resolve();

    const second = scheduler.schedule({ projectId: 'project-1', paths: ['src/b.ts'] });
    expect(aborted[0]?.aborted).toBe(true);
    releaseFirst();

    await expect(first).rejects.toThrow('aborted');
    await flushFirst;
    await second;
    expect(index).toHaveBeenCalledTimes(2);
  });
});
