import type { AgentPlan } from './AgentPlanner.js';
import type { ChangeSet, FileChange } from '@idle/contracts';

export class AgentChangeSetBuilder {
  createChangeSet(plan: AgentPlan, changes: readonly FileChange[] = []): ChangeSet {
    return {
      id: `changeset-${plan.taskId}`,
      description: plan.goal,
      changes: [...changes],
    };
  }
}
