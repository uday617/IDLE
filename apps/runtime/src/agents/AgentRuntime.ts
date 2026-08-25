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

export interface AgentMemoryItem {
  fact: unknown;
}

export interface AgentMemoryRetriever {
  retrieve(projectId: string, query: string, limit: number): Promise<readonly AgentMemoryItem[]>;
}

export interface AgentRuntimeOptions {
  maxTurns?: number;
  systemPrompt?: string;
  memory?: AgentMemoryRetriever;
}

const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MEMORY_LIMIT = 5;

export class AgentRuntime {
  private readonly maxTurns: number;
  private readonly systemPrompt: string | undefined;
  private readonly memory: AgentMemoryRetriever | undefined;

  constructor(
    private readonly provider: LLMProvider,
    private readonly tools: ToolRegistry,
    options: AgentRuntimeOptions = {},
  ) {
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.systemPrompt = options.systemPrompt;
    this.memory = options.memory;
    if (!Number.isInteger(this.maxTurns) || this.maxTurns < 1) {
      throw new Error('maxTurns must be a positive integer');
    }
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const messages: LLMMessage[] = [];
    if (this.systemPrompt) messages.push({ role: 'system', content: this.systemPrompt });

    if (this.memory) {
      try {
        const memories = await this.memory.retrieve(request.projectId, request.prompt, DEFAULT_MEMORY_LIMIT);
        if (memories.length > 0) {
          messages.push({
            role: 'system',
            content: `Relevant project memory:\n${memories.map((memory) => `- ${this.formatMemory(memory.fact)}`).join('\n')}`,
          });
        }
      } catch {
        // Memory is auxiliary context and must never block the task path.
      }
    }

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

  private formatMemory(fact: unknown): string {
    if (typeof fact === 'string') return fact;
    try {
      return JSON.stringify(fact);
    } catch {
      return String(fact);
    }
  }
}
