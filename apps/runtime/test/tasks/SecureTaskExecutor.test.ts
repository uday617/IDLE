import { describe, expect, it, vi } from 'vitest';
import { createSecureTaskExecutor } from '../../src/tasks/SecureTaskExecutor.js';
import type { ToolExecutor } from '../../src/agents/tools/ToolExecutor.js';

describe('SecureTaskExecutor', () => {
  it('delegates command execution to ToolExecutor', async () => {
    const execute = vi.fn(async () => ({ stdout: 'ok', stderr: '' }));
    const toolExecutor = { execute } as unknown as ToolExecutor;
    const runner = createSecureTaskExecutor(toolExecutor);

    const result = await runner({
      id: 'task-1',
      command: 'git status',
      cwd: '/workspace/project',
      policy: { allowedCommands: ['git'] },
    });

    expect(result).toEqual({ stdout: 'ok', stderr: '' });
    expect(execute).toHaveBeenCalledWith(
      'git status',
      '/workspace/project',
      { allowedCommands: ['git'] },
    );
  });

  it('propagates security-policy failures without bypassing ToolExecutor', async () => {
    const execute = vi.fn(async () => {
      throw new Error('Destructive command is blocked');
    });
    const toolExecutor = { execute } as unknown as ToolExecutor;
    const runner = createSecureTaskExecutor(toolExecutor);

    await expect(
      runner({
        id: 'task-2',
        command: 'rm -rf .',
        cwd: '/workspace/project',
        policy: { allowedCommands: ['git', 'node'] },
      }),
    ).rejects.toThrow('Destructive command is blocked');

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
