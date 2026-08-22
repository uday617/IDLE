import type { FailureContext, RepairOutcome } from '@idle/contracts';
import { RepairLoop, type RepairDecision, type RepairState } from './RepairLoop.js';
import { RepairAgent } from './RepairAgent.js';
import type { AgentProposalFile } from './AgentProposalEngine.js';
import type { TaskService } from '../tasks/TaskService.js';

export interface RepairCoordinatorOptions {
  loop?: RepairLoop;
  repairAgent?: RepairAgent;
}

export class RepairCoordinator {
  private readonly loop: RepairLoop;
  private readonly repairAgent: RepairAgent | undefined;
  private readonly states = new Map<string, RepairState>();

  constructor(private readonly tasks: TaskService, options: RepairCoordinatorOptions = {}) {
    this.loop = options.loop ?? new RepairLoop();
    this.repairAgent = options.repairAgent;
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

  async onVerificationFailureAndPropose(
    taskId: string,
    failure: FailureContext,
    files: readonly AgentProposalFile[] = [],
  ): Promise<RepairDecision> {
    const failureDecision = await this.onVerificationFailure(taskId, failure);
    if (failureDecision.kind !== 'request_repair' || !this.repairAgent) return failureDecision;

    const task = this.tasks.get(taskId);
    if (!task?.projectId || task.prompt === undefined) {
      return this.onRepairProposal(taskId, {
        kind: 'no_repair_proposal',
        reason: 'task is missing project context required for repair proposal generation',
      });
    }

    const outcome = await this.repairAgent.propose({
      taskId,
      projectId: task.projectId,
      goal: task.prompt,
      failure,
      files,
    });
    return this.onRepairProposal(taskId, outcome);
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
