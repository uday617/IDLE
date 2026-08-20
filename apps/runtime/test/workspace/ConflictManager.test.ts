import { describe, expect, it } from 'vitest';
import { ConflictManager } from '../../src/workspace/ConflictManager.js';

describe('ConflictManager', () => {
  it('serializes low-risk overlapping work', async () => {
    const manager = new ConflictManager();
    await expect(manager.resolve({ overlappingPaths: ['./src/a.ts', 'src/a.ts'], impact: 'low' })).resolves.toEqual({
      strategy: 'serialize',
      risk: 'low',
      paths: ['src/a.ts'],
    });
  });

  it('isolates high-risk overlapping work in a worktree', async () => {
    const manager = new ConflictManager();
    await expect(manager.resolve({ overlappingPaths: ['src/a.ts', 'src/b.ts'], impact: 'high' })).resolves.toEqual({
      strategy: 'worktree',
      risk: 'high',
      paths: ['src/a.ts', 'src/b.ts'],
    });
  });

  it('treats explicit high risk as an escalation signal', async () => {
    const manager = new ConflictManager();
    await expect(manager.resolve({ overlappingPaths: ['src/a.ts'], risk: 'high' })).resolves.toMatchObject({ strategy: 'worktree' });
  });
});
