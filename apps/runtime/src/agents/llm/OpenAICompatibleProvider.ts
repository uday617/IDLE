import type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMToolCall,
} from './LLMProvider.js';

export interface OpenAICompatibleProviderOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string | Record<string, unknown>;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements LLMProvider {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: OpenAICompatibleProviderOptions) {
    const baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.endpoint = `${baseUrl}/chat/completions`;
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;

    if (!baseUrl) throw new Error('baseUrl is required');
    if (!options.model) throw new Error('model is required');
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error('timeoutMs must be a positive integer');
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: request.messages.map(toOpenAIMessage),
          ...(request.tools.length > 0
            ? {
                tools: request.tools.map((tool) => ({
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  },
                })),
              }
            : {}),
        }),
      });

      const payload = await readJson(response);
      if (!response.ok) {
        const message = getErrorMessage(payload) ?? response.statusText ?? 'request failed';
        throw new Error(`OpenAI-compatible provider returned HTTP ${response.status}: ${message}`);
      }

      return normalizeResponse(payload);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`OpenAI-compatible provider request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function toOpenAIMessage(message: LLMMessage): Record<string, unknown> {
  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    };
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  return { role: message.role, content: message.content };
}

async function readJson(response: Response): Promise<ChatCompletionResponse> {
  try {
    return (await response.json()) as ChatCompletionResponse;
  } catch {
    throw new Error(`OpenAI-compatible provider returned invalid JSON (HTTP ${response.status})`);
  }
}

function getErrorMessage(payload: ChatCompletionResponse): string | undefined {
  const message = payload.error?.message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

function normalizeResponse(payload: ChatCompletionResponse): LLMResponse {
  const choice = payload.choices?.[0];
  if (!choice?.message) throw new Error('OpenAI-compatible provider returned no completion choice');

  const toolCalls: LLMToolCall[] = (choice.message.tool_calls ?? []).map((toolCall) => {
    const id = toolCall.id;
    const name = toolCall.function?.name;
    if (!id || !name) throw new Error('OpenAI-compatible provider returned an invalid tool call');

    const rawArguments = toolCall.function?.arguments;
    let argumentsValue: unknown = rawArguments;
    if (typeof rawArguments === 'string') {
      try {
        argumentsValue = JSON.parse(rawArguments);
      } catch {
        throw new Error(`Invalid tool arguments for ${name}`);
      }
    }

    if (!isRecord(argumentsValue)) throw new Error(`Invalid tool arguments for ${name}`);
    return { id, name, arguments: argumentsValue };
  });

  const finishReason = normalizeFinishReason(choice.finish_reason, toolCalls.length > 0);
  return {
    content: choice.message.content ?? '',
    toolCalls,
    finishReason,
  };
}

function normalizeFinishReason(reason: string | null | undefined, hasToolCalls: boolean): LLMResponse['finishReason'] {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  if (reason === 'tool_calls' || reason === 'function_call' || hasToolCalls) return 'tool_calls';
  return 'error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
