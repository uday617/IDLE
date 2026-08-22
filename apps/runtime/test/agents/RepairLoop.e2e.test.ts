import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import { RepairCoordinator } from '../../src/agents/RepairCoordinator.js';
import { RepairLoop } from '../../src/agents/RepairLoop.js';
import { TaskService } from '../../src/tasks/TaskService.js';

const failure = (attempt: number) => ({
  taskId: 'task-e2e' as never,
  attempt,
  checkId: 'intentional-failure',
  stdoutExcerpt: '',
  stderrExcerpt: 'expected failure',
  affectedPaths: ['fixture/bug.ts'],
  previousAttempts: [],
});

const changeset = (id: string): ChangeSet => ({
  id,
  description: 'deterministic repair for the intentional fixture failure',
  changes: [],
});

describe('bounded self-fix end-to-end flow', () => {
  it('moves failure -> repair -> review -> successful verification', async () => {
    const tasks = new TaskService();
    await tasks.create('task-e2e', 'fixture-project', 'repair the intentional fixture failure');
    const coordinator = new RepairCoordinator(tasks, { loop: new RepairLoop() });

    coordinator.start('task-e2e');

    const repairRequest = await coordinator.onVerificationFailure('task-e2e', failure(1));
    expect(repairRequest.kind).toBe('request_repair');
    expect(repairRequest.state.repairAttempts).toBe(1);
    expect(tasks.get('task-e2e')?.repairStatus).toBe('repair_pending');

    const review = await coordinator.onRepairProposal('task-e2e', {
      kind: 'changeset',
      changeset: changeset('repair-e2e-1'),
    });
    expect(review.kind).toBe('await_review');
    expect(review.changeSetId).toBe('repair-e2e-1');
    expect(tasks.get('task-e2e')?.repairStatus).toBe('review');

    const completed = await coordinator.onVerificationSuccess('task-e2e');
    expect(completed.kind).toBe('completed');
    expect(tasks.get('task-e2e')?.status).toBe('completed');
    expect(tasks.get('task-e2e')?.repairStatus).toBe('completed');
  });
});
