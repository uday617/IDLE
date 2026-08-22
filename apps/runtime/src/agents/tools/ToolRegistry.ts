import type { LLMToolCall, LLMToolDefinition } from '../llm/LLMProvider.js';

export interface AgentToolContext {
  projectId: string;
  taskId: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(arguments_: Record<string, unknown>, context: AgentToolContext): Promise<{ content: string }>;
}

export type AgentTool = AgentToolDefinition;

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  definitions(): LLMToolDefinition[] {
    return [...this.tools.values()].map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));
  }

  async execute(call: LLMToolCall, context: AgentToolContext): Promise<{ content: string }> {
    if (call.arguments === null || typeof call.arguments !== 'object' || Array.isArray(call.arguments)) {
      throw new Error(`Invalid arguments for tool: ${call.name}`);
    }
    const tool = this.tools.get(call.name);
    if (!tool) throw new Error(`Unknown tool: ${call.name}`);
    return tool.execute(call.arguments, context);
  }
}
