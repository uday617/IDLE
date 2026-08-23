import { describe, expect, it } from 'vitest';
import { MultiAgentCoordinator } from './MultiAgentCoordinator.js';
import type { ChangeSet, TaskId } from '@idle/contracts';

describe('MultiAgentCoordinator', () => {
  const changeSet = (id: string, path: string): ChangeSet => ({
    id,
    description: id,
    changes: [{ operation: 'create', path, baseContent: null, content: id }],
  });

  it('defaults to two concurrent agents', async () => {
    let active = 0;
    let peak = 0;
    const coordinator = new MultiAgentCoordinator(async (subtask) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { changeSet: changeSet(subtask.id, `${subtask.id}.ts`) };
    });

    const result = await coordinator.run({ id: 'task-1' as TaskId, prompt: [
      'SUBTASK 1: First', 'PATHS: a.ts', '', 'SUBTASK 2: Second', 'PATHS: b.ts', '', 'SUBTASK 3: Third', 'PATHS: c.ts',
    ].join('\n') });

    expect(peak).toBe(2);
    expect(result.status).toBe('completed');
  });

  it('never schedules more than the hard cap of four', async () => {
    let active = 0;
    let peak = 0;
    const coordinator = new MultiAgentCoordinator(async (subtask) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { changeSet: changeSet(subtask.id, `${subtask.id}.ts`) };
    });
    const prompt = Array.from({ length: 6 }, (_, index) => `SUBTASK ${index + 1}: Work ${index + 1}\nPATHS: ${index + 1}.ts`).join('\n\n');

    await coordinator.run({ id: 'task-2' as TaskId, prompt }, { defaultMaxAgents: 2, hardMaxAgents: 4, maxAgents: 8 });

    expect(peak).toBe(4);
  });

  it('does not aggregate when a required subtask fails', async () => {
    const coordinator = new MultiAgentCoordinator(async (subtask) => {
      if (subtask.id.endsWith('2')) throw new Error('boom');
      return { changeSet: changeSet(subtask.id, `${subtask.id}.ts`) };
    });

    const result = await coordinator.run({
      id: 'task-3' as TaskId,
      prompt: 'SUBTASK 1: First\nPATHS: a.ts\n\nSUBTASK 2: Second\nPATHS: b.ts',
    });

    expect(result.status).toBe('failed');
    expect(result.combinedChangeSet).toBeUndefined();
    expect(result.failures).toHaveLength(1);
  });

  it('propagates cancellation to running executors', async () => {
    const controller = new AbortController();
    let observedAbort = false;
    const coordinator = new MultiAgentCoordinator(async (_subtask, _agentId, signal) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          observedAbort = true;
          resolve();
        }, { once: true });
      });
      throw new Error('cancelled');
    });

    const promise = coordinator.run({
      id: 'task-4' as TaskId,
      prompt: 'SUBTASK 1: First\nPATHS: a.ts\n\nSUBTASK 2: Second\nPATHS: b.ts',
    }, undefined, controller.signal);
    controller.abort();

    const result = await promise;
    expect(observedAbort).toBe(true);
    expect(result.status).toBe('cancelled');
  });
});
