import { describe, expect, it, vi } from 'vitest';
import { IntegrationManager } from '../../src/orchestration/IntegrationManager.js';

function worktreeManager(merge: ReturnType<typeof vi.fn>) {
  return { merge };
}

describe('IntegrationManager', () => {
  it('integrates only after post-merge verification passes', async () => {
    const merge = vi.fn().mockResolvedValue({ merged: true, target: 'main', conflicts: [] });
    const verify = vi.fn().mockResolvedValue(true);
    const manager = new IntegrationManager(worktreeManager(merge), { verify });
    manager.register('task-1', { worktreeId: 'wt-1', target: 'main' });

    await expect(manager.integrate('task-1')).resolves.toEqual({
      taskId: 'task-1', integrated: true, target: 'main', conflicts: [], verificationPassed: true,
    });
    expect(merge).toHaveBeenCalledWith('wt-1', 'main');
    expect(verify).toHaveBeenCalledWith('task-1');
  });

  it('does not report success when verification fails', async () => {
    const merge = vi.fn().mockResolvedValue({ merged: true, target: 'main', conflicts: [] });
    const manager = new IntegrationManager(worktreeManager(merge), { verify: vi.fn().mockResolvedValue(false) });
    manager.register('task-2', { worktreeId: 'wt-2', target: 'main' });

    await expect(manager.integrate('task-2')).resolves.toEqual({
      taskId: 'task-2', integrated: false, target: 'main', conflicts: [], verificationPassed: false,
    });
  });

  it('returns conflict details without running verification after a failed merge', async () => {
    const merge = vi.fn().mockResolvedValue({ merged: false, target: 'main', conflicts: ['src/a.ts'] });
    const verify = vi.fn();
    const manager = new IntegrationManager(worktreeManager(merge), { verify });
    manager.register('task-3', { worktreeId: 'wt-3', target: 'main' });

    await expect(manager.integrate('task-3')).resolves.toEqual({
      taskId: 'task-3', integrated: false, target: 'main', conflicts: ['src/a.ts'], verificationPassed: false,
    });
    expect(verify).not.toHaveBeenCalled();
  });
});
