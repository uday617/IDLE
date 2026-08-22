import { describe, expect, it, vi } from 'vitest';
import { AgentRuntime } from '../../src/agents/AgentRuntime.js';
import type { AgentContext } from '../../src/agents/AgentContext.js';
import type { LLMProvider } from '../../src/agents/llm/LLMProvider.js';
import { ToolRegistry } from '../../src/agents/tools/ToolRegistry.js';

describe('AgentRuntime', () => {
  const context: AgentContext = {
    taskId: 'task-1',
    projectId: 'project-1',
    prompt: 'Add authentication',
    inspection: {
      projectPath: '/workspace/app',
      topLevelEntries: [{ name: 'src', kind: 'directory' }],
      packageName: 'demo-app',
    },
    plan: {
      taskId: 'task-1',
      projectId: 'project-1',
      goal: 'Add authentication',
      steps: [{ id: 'inspect-structure', description: 'Inspect the project structure' }],
    },
  };

  it('sends provider-neutral agent context to the injected provider', async () => {
    const provider: LLMProvider = {
      generate: vi.fn(async (request) => ({
        content: 'I will inspect the auth flow first.',
        finishReason: 'stop' as const,
        requestId: request.taskId,
      })),
    };
    const runtime = new AgentRuntime(provider, new ToolRegistry());

    const result = await runtime.run(context);

    expect(provider.generate).toHaveBeenCalledWith({
      taskId: 'task-1',
      system: expect.stringContaining('controlled tools'),
      messages: [{ role: 'user', content: 'Add authentication' }],
      context,
      tools: [],
    });
    expect(result).toEqual({
      taskId: 'task-1',
      content: 'I will inspect the auth flow first.',
      finishReason: 'stop',
      requestId: 'task-1',
    });
  });

  it('exposes only registered tools to the provider request', async () => {
    const provider: LLMProvider = {
      generate: vi.fn(async (request) => ({
        content: 'ready',
        finishReason: 'stop' as const,
        requestId: request.taskId,
      })),
    };
    const tools = new ToolRegistry();
    tools.register({
      name: 'read_file',
      description: 'Read a project file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      execute: async () => ({ content: 'safe' }),
    });
    const runtime = new AgentRuntime(provider, tools);

    await runtime.run(context);

    expect(provider.generate).toHaveBeenCalledWith(expect.objectContaining({
      tools: [{
        name: 'read_file',
        description: 'Read a project file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      }],
    }));
  });

  it('does not execute tools during provider generation', async () => {
    const execute = vi.fn(async () => ({ content: 'secret' }));
    const provider: LLMProvider = {
      generate: vi.fn(async (request) => ({
        content: 'I need a tool call.',
        finishReason: 'tool_call' as const,
        requestId: request.taskId,
        toolCalls: [{ id: 'call-1', name: 'read_file', arguments: { path: 'src/app.ts' } }],
      })),
    };
    const tools = new ToolRegistry();
    tools.register({
      name: 'read_file',
      description: 'Read a project file',
      inputSchema: { type: 'object' },
      execute,
    });
    const runtime = new AgentRuntime(provider, tools);

    const result = await runtime.run(context);

    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'read_file', arguments: { path: 'src/app.ts' } }]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects duplicate tool registrations', () => {
    const tools = new ToolRegistry();
    const definition = {
      name: 'read_file',
      description: 'Read a project file',
      inputSchema: { type: 'object' },
      execute: async () => null,
    };
    tools.register(definition);
    expect(() => tools.register(definition)).toThrow('Tool already registered: read_file');
  });
});
