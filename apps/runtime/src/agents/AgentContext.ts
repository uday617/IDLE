import type { AgentExecutionResult } from './AgentExecutor.js';
import type { AgentPlan } from './AgentPlanner.js';

export interface AgentContext {
  taskId: string;
  projectId: string;
  prompt: string;
  inspection: AgentExecutionResult;
  plan: AgentPlan;
}
