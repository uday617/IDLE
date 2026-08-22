import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../../../src/agents/llm/OpenAICompatibleProvider.js';

describe('OpenAICompatibleProvider', () => {
  it('maps chat completions and tool calls into the normalized provider contract', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: 'I need to inspect the file.',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: '{"path":"src/app.ts"}',
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
      fetcher,
    });

    const response = await provider.generate({
      messages: [
        { role: 'user', content: 'Inspect src/app.ts' },
      ],
      tools: [{
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      }],
    });

    expect(response).toEqual({
      content: 'I need to inspect the file.',
      finishReason: 'tool_calls',
      toolCalls: [{
        id: 'call-1',
        name: 'read_file',
        arguments: { path: 'src/app.ts' },
      }],
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://example.test/v1/chat/completions');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Inspect src/app.ts' }],
      tools: [{
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        },
      }],
    });
    expect((fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>)['authorization']).toBe('Bearer test-key');
  });

  it('serializes assistant tool calls and tool results for the next provider turn', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Done' }, finish_reason: 'stop' }],
    }), { status: 200 }));
    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://example.test/v1', model: 'test-model', fetcher });

    await provider.generate({
      messages: [
        { role: 'user', content: 'Inspect app.ts' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call-1', name: 'read_file', arguments: { path: 'app.ts' } }],
        },
        { role: 'tool', content: 'file contents', toolCallId: 'call-1' },
      ],
      tools: [],
    });

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.messages).toEqual([
      { role: 'user', content: 'Inspect app.ts' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path":"app.ts"}' },
        }],
      },
      { role: 'tool', content: 'file contents', tool_call_id: 'call-1' },
    ]);
  });

  it('supports providers that omit authentication', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Done' }, finish_reason: 'stop' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1/',
      model: 'local-model',
      fetcher,
    });

    await provider.generate({ messages: [{ role: 'user', content: 'Hello' }], tools: [] });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:11434/v1/chat/completions');
    expect((fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>)['authorization']).toBeUndefined();
  });

  it('turns non-success HTTP responses into provider errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    }));
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      model: 'test-model',
      fetcher,
    });

    await expect(provider.generate({ messages: [], tools: [] })).rejects.toThrow('OpenAI-compatible provider returned HTTP 429: rate limited');
  });

  it('rejects malformed tool arguments instead of silently coercing them', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: '',
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{not-json}' } }],
        },
        finish_reason: 'tool_calls',
      }],
    }), { status: 200 }));
    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://example.test/v1', model: 'test-model', fetcher });

    await expect(provider.generate({ messages: [], tools: [] })).rejects.toThrow('Invalid tool arguments for read_file');
  });

  it('aborts requests that exceed the configured timeout', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    });
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      model: 'test-model',
      timeoutMs: 1,
      fetcher,
    });

    await expect(provider.generate({ messages: [], tools: [] })).rejects.toThrow('OpenAI-compatible provider request timed out after 1ms');
  });
});
