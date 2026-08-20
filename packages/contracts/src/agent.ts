import type { PermissionLevel } from './permissions.js';

export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type AgentId = string & { readonly __brand: 'AgentId' };

export type TaskStatus = 'queued' | 'planning' | 'running' | 'verifying' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type AgentStatus = 'created' | 'initializing' | 'understanding' | 'planning' | 'executing' | 'verifying' | 'review' | 'completed' | 'recovering' | 'conflict_resolution' | 'paused' | 'failed' | 'cancelled';

export interface AgentEvent<T = unknown> {
  id: string;
  timestamp: string;
  taskId: TaskId;
  agentId?: AgentId;
  type: string;
  payload: T;
}

export interface PermissionDecision {
  level: PermissionLevel;
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}
