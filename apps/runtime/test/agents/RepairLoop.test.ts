import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import { RepairLoop } from '../../src/agents/RepairLoop.js';

const failure = (attempt: number) => ({
  taskId: 'task-1' as never,
  attempt,
  checkId: 'typecheck',
  stdoutExcerpt: '',
  stderrExcerpt: 'failure',
  affectedPaths: ['src/a.ts'],
  previousAttempts: [],
});

const changeset = (id: string): ChangeSet => ({ id, description: 'repair', changes: [] });

describe('RepairLoop', () => {
  it('requests repair for the first three failures', () => {
    const loop = new RepairLoop();
    let state = loop.start('task-1');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const decision = loop.onVerificationFailure(state, failure(attempt));
      expect(decision.kind).toBe('request_repair');
      state = decision.state;
    }

    expect(state.repairAttempts).toBe(3);
    expect(state.status).toBe('repair_pending');
  });

  it('hard stops after three repair attempts', () => {
    const loop = new RepairLoop();
    let state = loop.start('task-1');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state = loop.onVerificationFailure(state, failure(attempt)).state;
    }

    const decision = loop.onVerificationFailure(state, failure(4));
    expect(decision.kind).toBe('failed');
    expect(decision.state.repairAttempts).toBe(3);
  });

  it('requires review for a repair changeset', () => {
    const loop = new RepairLoop();
    const state = loop.onVerificationFailure(loop.start('task-1'), failure(1)).state;
    const decision = loop.onRepairProposal(state, { kind: 'changeset', changeset: changeset('cs-2') });

    expect(decision.kind).toBe('await_review');
    expect(decision.changeSetId).toBe('cs-2');
    expect(decision.state.status).toBe('review');
  });

  it('fails cleanly when no repair proposal exists', () => {
    const loop = new RepairLoop();
    const state = loop.onVerificationFailure(loop.start('task-1'), failure(1)).state;
    const decision = loop.onRepairProposal(state, { kind: 'no_repair_proposal', reason: 'model could not identify a safe fix' });

    expect(decision.kind).toBe('failed');
    expect(decision.state.status).toBe('failed');
  });

  it('completes immediately when verification succeeds', () => {
    const loop = new RepairLoop();
    const decision = loop.onVerificationSuccess(loop.start('task-1'));
    expect(decision.kind).toBe('completed');
    expect(decision.state.status).toBe('completed');
  });
});
