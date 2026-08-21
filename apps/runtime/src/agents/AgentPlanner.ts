import type { AgentExecutionResult } from './AgentExecutor.js';

export interface AgentPlanStep {
  id: string;
  description: string;
}

export interface AgentPlan {
  taskId: string;
  projectId: string;
  goal: string;
  steps: AgentPlanStep[];
}

export class AgentPlanner {
  createPlan(context: AgentExecutionResult): AgentPlan {
    const steps: AgentPlanStep[] = [
      { id: 'inspect-structure', description: 'Inspect the project structure' },
    ];

    if (context.packageName) {
      steps.push({ id: 'inspect-package', description: 'Inspect package metadata' });
    }

    return {
      taskId: context.taskId,
      projectId: context.projectId,
      goal: context.prompt,
      steps,
    };
  }
}
