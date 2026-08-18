import type { AgentId } from './agent.js';

export interface ToolRequest<T = unknown> {
  requestId: string;
  agentId: AgentId;
  toolName: string;
  arguments: T;
}

export interface ToolResult<T = unknown> {
  requestId: string;
  ok: boolean;
  result?: T;
  error?: string;
}
