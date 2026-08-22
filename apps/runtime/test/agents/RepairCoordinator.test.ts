import { describe, expect, it } from 'vitest';
import { RepairCoordinator } from '../../src/agents/RepairCoordinator.js';
import { TaskService } from '../../src/tasks/TaskService.js';

const failure = (attempt: number) => ({
  taskId: 'task-1' as never,
  attempt,
  checkId: 'typecheck',
  stderrExcerpt: 'failed',
  stdoutExcerpt: '',
  affectedPaths: ['src/a.ts'],
  previousAttempts: [],
});

describe('RepairCoordinator', () => {
  it('records failure and stops at the review boundary', async () => {
    const tasks = new TaskService();
    await tasks.create('task-1', 'project-1', 'repair task');
    const coordinator = new RepairCoordinator(tasks);
    coordinator.start('task-1');

    const failed = await coordinator.onVerificationFailure('task-1', failure(1));
    expect(failed.kind).toBe('request_repair');
    expect(tasks.get('task-1')?.repairAttempts).toBe(1);

    const proposal = await coordinator.onRepairProposal('task-1', {
      kind: 'changeset',
      changeset: { id: 'repair-1', description: 'repair', changes: [] },
    });
    expect(proposal.kind).toBe('await_review');
    expect(tasks.get('task-1')?.repairStatus).toBe('review');
  });
});
