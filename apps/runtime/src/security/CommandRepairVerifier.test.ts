import { describe, expect, it } from 'vitest';
import type { FailureContext } from '@idle/contracts';
import { SecurityPolicy } from './SecurityPolicy.js';
import { SecureCommandExecutor } from './SecureCommandExecutor.js';
import { CommandRepairVerifier } from './CommandRepairVerifier.js';

describe('CommandRepairVerifier', () => {
  it('returns no failure for a successful verification command', async () => {
    const verifier = new CommandRepairVerifier(
      new SecureCommandExecutor(SecurityPolicy, { allowedCommands: ['node'] }),
    );

    const failure = await verifier.verify({
      taskId: 'task-1' as never,
      projectId: 'project-1',
      cwd: process.cwd(),
      command: 'node -e console.log("ok")',
      checkId: 'unit-check',
      attempt: 2,
      previousAttempts: [],
    });

    expect(failure).toBeNull();
  });

  it('returns structured failure context for a failed command', async () => {
    const verifier = new CommandRepairVerifier(
      new SecureCommandExecutor(SecurityPolicy, { allowedCommands: ['node'] }),
    );

    const failure = await verifier.verify({
      taskId: 'task-2' as never,
      projectId: 'project-1',
      cwd: process.cwd(),
      command: 'node -e throw',
      checkId: 'unit-check',
      attempt: 3,
      previousAttempts: [],
    });

    expect(failure).toMatchObject<Partial<FailureContext>>({
      taskId: 'task-2' as FailureContext['taskId'],
      attempt: 3,
      checkId: 'unit-check',
      exitCode: 1,
      stdoutExcerpt: '',
      previousAttempts: [],
    });
    expect(failure?.stderrExcerpt).not.toBe('');
  });
});
