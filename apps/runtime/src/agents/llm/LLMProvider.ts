import type { AgentContext } from '../AgentContext.js';
import type { AgentToolDefinition } from '../tools/ToolRegistry.js';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMGenerateRequest {
  taskId: string;
  system: string;
  messages: readonly LLMMessage[];
  context: AgentContext;
  tools: readonly AgentToolDefinition[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMGenerateResponse {
  content: string;
  finishReason: 'stop' | 'tool_call' | 'length' | 'error';
  requestId?: string;
  toolCalls?: readonly LLMToolCall[];
}

export interface LLMProvider {
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse>;
}
