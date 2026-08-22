import type { AgentContext } from './AgentContext.js';
import type { LLMGenerateResponse, LLMProvider } from './llm/LLMProvider.js';
import { ToolRegistry } from './tools/ToolRegistry.js';

export interface AgentRunResult {
  taskId: string;
  content: string;
  finishReason: LLMGenerateResponse['finishReason'];
  requestId?: string;
  toolCalls?: LLMGenerateResponse['toolCalls'];
}

const SYSTEM_PROMPT = [
  'You are an agent inside IDLE, a review-first coding IDE.',
  'Inspect the supplied project context before proposing changes.',
  'Use only the controlled tools exposed in the request.',
  'Never assume direct filesystem or shell access.',
  'Code changes must remain reviewable through the existing ChangeSet pipeline.',
].join(' ');

export class AgentRuntime {
  constructor(
    private readonly provider: LLMProvider,
    private readonly tools: ToolRegistry,
  ) {}

  async run(context: AgentContext): Promise<AgentRunResult> {
    const response = await this.provider.generate({
      taskId: context.taskId,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context.prompt }],
      context,
      tools: this.tools.definitions(),
    });

    return {
      taskId: context.taskId,
      content: response.content,
      finishReason: response.finishReason,
      ...(response.requestId ? { requestId: response.requestId } : {}),
      ...(response.toolCalls ? { toolCalls: response.toolCalls } : {}),
    };
  }
}
