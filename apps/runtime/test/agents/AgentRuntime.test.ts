import { describe, expect, it, vi } from 'vitest';
import { AgentRuntime } from '../../src/agents/AgentRuntime.js';
import type { LLMProvider } from '../../src/agents/llm/LLMProvider.js';
import { ToolRegistry } from '../../src/agents/tools/ToolRegistry.js';

type ProviderResponse = Awaited<ReturnType<LLMProvider['generate']>>;

const fakeProvider = (...responses: ProviderResponse[]): LLMProvider => ({
  generate: vi.fn(async (request) => {
    void request;
    return responses.shift() ?? { content: '', toolCalls: [], finishReason: 'stop' as const };
  }),
});

const registryWithTool = (name: string, execute: (args: Record<string, unknown>) => Promise<{ content: string }>) => {
  const registry = new ToolRegistry();
  registry.register({
    name,
    description: `Test ${name} tool`,
    parameters: { type: 'object', properties: {} },
    execute: async (args) => execute(args),
  });
  return registry;
};

describe('AgentRuntime', () => {
  it('normalizes tool definitions and executes registered tools with context', async () => {
    const execute = vi.fn(async () => ({ content: 'ok' }));
    const registry = new ToolRegistry();
    registry.register({
      name: 'read_file',
      description: 'Read a project file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      execute,
    });

    expect(registry.definitions()).toEqual([{
      name: 'read_file',
      description: 'Read a project file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    }]);

    await expect(registry.execute(
      { id: 'call-1', name: 'read_file', arguments: { path: 'src/index.ts' } },
      { projectId: 'p1', taskId: 't1' },
    )).resolves.toEqual({ content: 'ok' });

    expect(execute).toHaveBeenCalledWith({ path: 'src/index.ts' }, { projectId: 'p1', taskId: 't1' });
  });

  it('finishes in one turn on final text', async () => {
    const provider = fakeProvider({ content: 'done', toolCalls: [], finishReason: 'stop' });
    const runtime = new AgentRuntime(provider, new ToolRegistry());

    await expect(runtime.run({ taskId: 't1', projectId: 'p1', prompt: 'inspect' })).resolves.toMatchObject({
      taskId: 't1', content: 'done', finishReason: 'stop', turns: 1,
    });
  });

  it('preserves assistant tool calls for the next provider turn', async () => {
    const provider = fakeProvider(
      { content: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'a.ts' } }], finishReason: 'tool_calls' },
      { content: 'found it', toolCalls: [], finishReason: 'stop' },
    );
    const registry = registryWithTool('read_file', async () => ({ content: 'file contents' }));
    await new AgentRuntime(provider, registry).run({ taskId: 't1', projectId: 'p1', prompt: 'find it' });

    const requests = (provider.generate as ReturnType<typeof vi.fn>).mock.calls;
    expect(requests[1][0].messages.at(-2)).toEqual({
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'a.ts' } }],
    });
  });

  it('feeds tool results into the next provider turn', async () => {
    const provider = fakeProvider(
      { content: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'a.ts' } }], finishReason: 'tool_calls' },
      { content: 'found it', toolCalls: [], finishReason: 'stop' },
    );
    const registry = registryWithTool('read_file', async () => ({ content: 'file contents' }));
    const runtime = new AgentRuntime(provider, registry);

    await runtime.run({ taskId: 't2', projectId: 'p1', prompt: 'find it' });
    const requests = (provider.generate as ReturnType<typeof vi.fn>).mock.calls;
    expect(requests[1][0].messages.at(-1)).toEqual({ role: 'tool', content: 'file contents', toolCallId: 'c1' });
  });

  it('rejects unknown tools without executing anything', async () => {
    const execute = vi.fn(async () => ({ content: 'should not run' }));
    const registry = registryWithTool('read_file', execute);
    const provider = fakeProvider({
      content: '',
      toolCalls: [{ id: 'c1', name: 'delete_everything', arguments: {} }],
      finishReason: 'tool_calls',
    });

    const result = await new AgentRuntime(provider, registry).run({ taskId: 't3', projectId: 'p1', prompt: 'x' });

    expect(result.finishReason).toBe('error');
    expect(result.error).toContain('Unknown tool');
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops after maxTurns without an unbounded retry loop', async () => {
    const provider = fakeProvider(
      { content: '', toolCalls: [{ id: 'c1', name: 'inspect', arguments: {} }], finishReason: 'tool_calls' },
      { content: '', toolCalls: [{ id: 'c2', name: 'inspect', arguments: {} }], finishReason: 'tool_calls' },
      { content: '', toolCalls: [{ id: 'c3', name: 'inspect', arguments: {} }], finishReason: 'tool_calls' },
    );
    const runtime = new AgentRuntime(provider, registryWithTool('inspect', async () => ({ content: 'ok' })), { maxTurns: 2 });

    const result = await runtime.run({ taskId: 't4', projectId: 'p1', prompt: 'loop' });

    expect(result.finishReason).toBe('length');
    expect(result.turns).toBe(2);
    expect(provider.generate).toHaveBeenCalledTimes(2);
  });

  it('turns malformed tool arguments into a controlled tool result', async () => {
    const provider = fakeProvider(
      { content: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: null as never }], finishReason: 'tool_calls' },
      { content: 'cannot read', toolCalls: [], finishReason: 'stop' },
    );
    const runtime = new AgentRuntime(provider, registryWithTool('read_file', async () => ({ content: 'should not run' })));

    const result = await runtime.run({ taskId: 't5', projectId: 'p1', prompt: 'read' });
    const requests = (provider.generate as ReturnType<typeof vi.fn>).mock.calls;

    expect(result.content).toBe('cannot read');
    expect(requests[1][0].messages.at(-1)?.content).toContain('Invalid arguments');
  });

  it('converts provider failure to a controlled task result', async () => {
    const provider: LLMProvider = { generate: vi.fn().mockRejectedValue(new Error('provider unavailable')) };

    const result = await new AgentRuntime(provider, new ToolRegistry()).run({ taskId: 't6', projectId: 'p1', prompt: 'x' });

    expect(result).toMatchObject({ finishReason: 'error', error: 'provider unavailable', turns: 1 });
  });

  it('includes optional system guidance before the task prompt', async () => {
    const provider = fakeProvider({ content: 'done', toolCalls: [], finishReason: 'stop' });
    const runtime = new AgentRuntime(provider, new ToolRegistry(), { systemPrompt: 'Use review-first tools.' });

    await runtime.run({ taskId: 't7', projectId: 'p1', prompt: 'Inspect the project' });

    const request = (provider.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.messages).toEqual([
      { role: 'system', content: 'Use review-first tools.' },
      { role: 'user', content: 'Inspect the project' },
    ]);
  });

  it('injects retrieved project memory before the task prompt', async () => {
    const provider = fakeProvider({ content: 'done', toolCalls: [], finishReason: 'stop' });
    const memory = {
      retrieve: vi.fn(async () => [{ fact: 'Use PostgreSQL for persistence' }]),
    };
    const runtime = new AgentRuntime(provider, new ToolRegistry(), { memory });

    await runtime.run({ taskId: 't8', projectId: 'p1', prompt: 'Inspect the persistence layer' });

    expect(memory.retrieve).toHaveBeenCalledWith('p1', 'Inspect the persistence layer', 5);
    const request = (provider.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.messages).toEqual([
      { role: 'system', content: 'Relevant project memory:\n- Use PostgreSQL for persistence' },
      { role: 'user', content: 'Inspect the persistence layer' },
    ]);
  });
});
