import type { LLMMessage, LLMProvider, LLMResponse } from './llm/LLMProvider.js';
import { ToolRegistry } from './tools/ToolRegistry.js';

export interface AgentRunRequest {
  taskId: string;
  projectId: string;
  prompt: string;
}

export interface AgentRunResult {
  taskId: string;
  content: string;
  finishReason: LLMResponse['finishReason'];
  turns: number;
  error?: string;
}

export interface AgentRuntimeOptions {
  maxTurns?: number;
  systemPrompt?: string;
}

const DEFAULT_MAX_TURNS = 8;

export class AgentRuntime {
  private readonly maxTurns: number;
  private readonly systemPrompt?: string;

  constructor(
    private readonly provider: LLMProvider,
    private readonly tools: ToolRegistry,
    options: AgentRuntimeOptions = {},
  ) {
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.systemPrompt = options.systemPrompt;
    if (!Number.isInteger(this.maxTurns) || this.maxTurns < 1) {
      throw new Error('maxTurns must be a positive integer');
    }
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const messages: LLMMessage[] = [];
    if (this.systemPrompt) messages.push({ role: 'system', content: this.systemPrompt });
    messages.push({ role: 'user', content: request.prompt });
    const tools = this.tools.definitions();

    for (let turn = 1; turn <= this.maxTurns; turn += 1) {
      let response: LLMResponse;
      try {
        response = await this.provider.generate({ messages, tools });
      } catch (error) {
        return {
          taskId: request.taskId,
          content: '',
          finishReason: 'error',
          turns: turn,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (response.finishReason === 'stop') {
        return {
          taskId: request.taskId,
          content: response.content,
          finishReason: 'stop',
          turns: turn,
        };
      }

      if (response.finishReason === 'error') {
        return {
          taskId: request.taskId,
          content: response.content,
          finishReason: 'error',
          turns: turn,
        };
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {}),
      });

      if (response.finishReason !== 'tool_calls' || response.toolCalls.length === 0) {
        return {
          taskId: request.taskId,
          content: response.content,
          finishReason: response.finishReason,
          turns: turn,
        };
      }

      for (const call of response.toolCalls) {
        try {
          const result = await this.tools.execute(call, {
            projectId: request.projectId,
            taskId: request.taskId,
          });
          messages.push({ role: 'tool', content: result.content, toolCallId: call.id });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.startsWith('Unknown tool:')) {
            return {
              taskId: request.taskId,
              content: '',
              finishReason: 'error',
              turns: turn,
              error: message,
            };
          }
          messages.push({
            role: 'tool',
            content: `Tool ${call.name} failed: ${message}`,
            toolCallId: call.id,
          });
        }
      }
    }

    return {
      taskId: request.taskId,
      content: '',
      finishReason: 'length',
      turns: this.maxTurns,
      error: `Agent reached the maximum turn limit of ${this.maxTurns}`,
    };
  }
}
