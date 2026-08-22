import type { FailureContext, RepairOutcome } from '@idle/contracts';
import { RepairLoop, type RepairDecision, type RepairState } from './RepairLoop.js';
import type { TaskService } from '../tasks/TaskService.js';

export interface RepairCoordinatorOptions {
  loop?: RepairLoop;
}

export class RepairCoordinator {
  private readonly loop: RepairLoop;
  private readonly states = new Map<string, RepairState>();

  constructor(private readonly tasks: TaskService, options: RepairCoordinatorOptions = {}) {
    this.loop = options.loop ?? new RepairLoop();
  }

  start(taskId: string): RepairState {
    const state = this.loop.start(taskId);
    this.states.set(taskId, state);
    return state;
  }

  async onVerificationFailure(taskId: string, failure: FailureContext): Promise<RepairDecision> {
    const current = this.states.get(taskId) ?? this.loop.start(taskId);
    const decision = this.loop.onVerificationFailure(current, failure);
    this.states.set(taskId, decision.state);
    await this.tasks.recordRepairFailure(taskId, failure);
    return decision;
  }

  async onRepairProposal(taskId: string, outcome: RepairOutcome): Promise<RepairDecision> {
    const current = this.states.get(taskId) ?? this.loop.start(taskId);
    const decision = this.loop.onRepairProposal(current, outcome);
    this.states.set(taskId, decision.state);
    if (decision.kind === 'await_review') await this.tasks.markRepairReview(taskId);
    if (decision.kind === 'failed') await this.tasks.fail(taskId, decision.reason);
    return decision;
  }

  async onVerificationSuccess(taskId: string): Promise<RepairDecision> {
    const current = this.states.get(taskId) ?? this.loop.start(taskId);
    const decision = this.loop.onVerificationSuccess(current);
    this.states.set(taskId, decision.state);
    await this.tasks.complete(taskId);
    return decision;
  }
}
