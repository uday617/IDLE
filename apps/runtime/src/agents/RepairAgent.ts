import type { FailureContext, RepairOutcome } from '@idle/contracts';
import { AgentProposalEngine, type AgentProposalFile } from './AgentProposalEngine.js';
import { AgentRuntime } from './AgentRuntime.js';

export interface RepairAgentRequest {
  taskId: string;
  projectId: string;
  goal: string;
  failure: FailureContext;
  files?: readonly AgentProposalFile[];
}

export class RepairAgent {
  constructor(
    private readonly runtime: AgentRuntime,
    private readonly proposalEngine = new AgentProposalEngine(),
  ) {}

  async propose(request: RepairAgentRequest): Promise<RepairOutcome> {
    const prompt = [
      'Repair the failed coding task without applying changes directly.',
      `Original goal: ${request.goal}`,
      `Verification check: ${request.failure.checkId}`,
      `Repair attempt: ${request.failure.attempt}`,
      `Exit code: ${request.failure.exitCode ?? 'unknown'}`,
      `Affected paths: ${request.failure.affectedPaths.join(', ') || 'unknown'}`,
      `stderr:\n${request.failure.stderrExcerpt}`,
      `stdout:\n${request.failure.stdoutExcerpt}`,
      'Return a minimal ChangeSet proposal using the supported proposal syntax.',
    ].join('\n\n');

    const result = await this.runtime.run({ taskId: request.taskId, projectId: request.projectId, prompt });
    if (result.finishReason !== 'stop' || !result.content.trim()) {
      return { kind: 'no_repair_proposal', reason: result.error ?? 'repair agent did not produce a proposal' };
    }

    try {
      const changeset = this.proposalEngine.propose({
        taskId: `${request.taskId}-repair-${request.failure.attempt}`,
        goal: result.content,
        files: request.files,
      });
      if (changeset.changes.length === 0) {
        return { kind: 'no_repair_proposal', reason: 'repair agent produced no supported changes' };
      }
      return { kind: 'changeset', changeset };
    } catch (error) {
      return { kind: 'no_repair_proposal', reason: error instanceof Error ? error.message : String(error) };
    }
  }
}
