import type { AgentId, TaskId } from './agent.js';

export interface AgentSubtask {
  id: string;
  parentTaskId: TaskId;
  prompt: string;
  claimedPaths?: string[];
}

export interface MultiAgentConfig {
  defaultMaxAgents: number;
  hardMaxAgents: number;
  maxAgents?: number;
}

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'conflict';

export interface AgentRunRecord {
  subtaskId: string;
  agentId: AgentId;
  status: AgentRunStatus;
  claimedPaths: string[];
  changeSetId?: string;
  error?: string;
}

export interface CoordinationEvent<T = unknown> {
  id: string;
  timestamp: string;
  taskId: TaskId;
  type: string;
  payload: T;
}
