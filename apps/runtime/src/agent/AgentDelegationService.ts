import type { AgentRequest, AgentRequestService } from './AgentRequestService.js';
import type { AgentLearningService, LearningContext } from './AgentLearningService.js';

export interface DelegationResult<T> {
  decision: 'allow' | 'deny' | 'approval_required';
  parentAgentId: string;
  childAgentId: string;
  context?: LearningContext;
  result?: T;
  reason: string;
}

export interface AgentExecution<T> {
  execute(context: LearningContext): Promise<{ success: boolean; result: T; summary: string }>;
}

export class AgentDelegationService {
  constructor(
    private readonly requests: AgentRequestService,
    private readonly learning: AgentLearningService,
  ) {}

  async delegate<T>(
    parentAgentId: string,
    childAgentId: string,
    request: AgentRequest,
    taskDescription: string,
    execution: AgentExecution<T>,
  ): Promise<DelegationResult<T>> {
    const decision = this.requests.request(parentAgentId, request);
    if (decision.decision !== 'allow') {
      return {
        decision: decision.decision,
        parentAgentId,
        childAgentId,
        reason: decision.reason,
      };
    }

    const context = this.learning.recallForTask({
      agentId: childAgentId,
      description: taskDescription,
    });

    try {
      const outcome = await execution.execute(context);
      this.learning.recordOutcome(
        { agentId: childAgentId, description: taskDescription },
        { success: outcome.success, summary: outcome.summary },
      );
      return {
        decision: 'allow',
        parentAgentId,
        childAgentId,
        context,
        result: outcome.result,
        reason: 'Delegation completed',
      };
    } catch (error) {
      this.learning.recordOutcome(
        { agentId: childAgentId, description: taskDescription },
        { success: false, summary: error instanceof Error ? error.message : 'Delegated execution failed' },
      );
      throw error;
    }
  }
}
