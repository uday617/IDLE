import { describe, expect, it } from 'vitest';
import { FileCoordinator } from '../../src/workspace/FileCoordinator.js';

describe('FileCoordinator', () => {
  it('allows non-overlapping reservations', async () => {
    const coordinator = new FileCoordinator();

    const first = await coordinator.reserve('agent-a', ['src/a.ts']);
    const second = await coordinator.reserve('agent-b', ['src/b.ts']);

    expect(first).toEqual({ id: 'reservation-1', agentId: 'agent-a', paths: ['src/a.ts'] });
    expect(second).toEqual({ id: 'reservation-2', agentId: 'agent-b', paths: ['src/b.ts'] });
    await expect(coordinator.conflicts(['src/c.ts'])).resolves.toEqual([]);
  });

  it('reports overlapping reservations and rejects a conflicting reservation', async () => {
    const coordinator = new FileCoordinator();
    await coordinator.reserve('agent-a', ['src/a.ts', 'src/shared.ts']);

    await expect(coordinator.conflicts(['src/shared.ts', 'src/other.ts'])).resolves.toEqual([
      { agentId: 'agent-a', paths: ['src/shared.ts'] },
    ]);
    await expect(coordinator.reserve('agent-b', ['src/shared.ts'])).rejects.toThrow(
      'File reservation conflict: src/shared.ts',
    );
  });

  it('releases all paths after a reservation is released', async () => {
    const coordinator = new FileCoordinator();
    const reservation = await coordinator.reserve('agent-a', ['src/a.ts', 'src/b.ts']);

    await coordinator.release(reservation.id);

    await expect(coordinator.conflicts(['src/a.ts', 'src/b.ts'])).resolves.toEqual([]);
    await expect(coordinator.reserve('agent-b', ['src/a.ts', 'src/b.ts'])).resolves.toEqual({
      id: 'reservation-2',
      agentId: 'agent-b',
      paths: ['src/a.ts', 'src/b.ts'],
    });
  });
});
