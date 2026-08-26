import type { AgentId, AgentStatus, TaskId, TaskStatus, ProjectId } from './agent.js';
import type { ChangeSet, ChangeSetReviewResult } from './changes.js';
import type { MultiAgentBudget } from './multiAgent.js';

export interface Task { id: TaskId; title: string; description: string; status: TaskStatus; }
export interface TaskOrchestrationRequest {
  enabled: boolean;
  maxAgents?: number;
  maxDelegationDepth?: number;
  maxTaskTokens?: number;
  maxApiCalls?: number;
  idleTimeoutMs?: number;
}
export interface TaskSubmitRequest { taskId: TaskId; projectId: ProjectId; prompt: string; orchestration?: TaskOrchestrationRequest; }
export interface TaskSubmitResult { taskId: TaskId; status: TaskStatus; }
export interface TaskStatusEvent { taskId: TaskId; status: TaskStatus; timestamp: string; message?: string; }

export interface TaskPlanStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description?: string;
}

export interface TaskAgentView {
  agentId: AgentId;
  role: string;
  status: AgentStatus;
  progress: number;
  currentAction?: string;
  claimedPaths: string[];
  error?: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  detail?: string;
  durationMs?: number;
}

export interface TaskActionLedgerEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target?: string;
  result: 'started' | 'completed' | 'rejected' | 'failed';
  detail?: string;
}

export interface TaskApprovalRequest {
  id: string;
  action: string;
  target?: string;
  reason: string;
  dangerous: true;
}

export interface TaskConflict {
  id: string;
  paths: string[];
  agents: AgentId[];
  status: 'open' | 'resolved' | 'isolated';
  resolution?: string;
}

export interface TaskWorkspaceState {
  task: Task;
  prompt: string;
  plan: TaskPlanStep[];
  agents: TaskAgentView[];
  files: string[];
  verification: VerificationCheck[];
  ledger: TaskActionLedgerEntry[];
  conflicts: TaskConflict[];
  pendingApproval?: TaskApprovalRequest;
  budget?: MultiAgentBudget;
  finalReport?: string;
}

export interface TaskResult {
  taskId: TaskId;
  status: Extract<TaskStatus, 'completed' | 'failed' | 'cancelled' | 'paused'>;
  summary?: string;
  error?: string;
  changeSetId?: string;
  changeSet?: ChangeSet;
  changeSetReview?: ChangeSetReviewResult;
  workspace?: TaskWorkspaceState;
}
