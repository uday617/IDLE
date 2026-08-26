import { describe, expect, it } from 'vitest';
import { AgentRuntime } from './AgentRuntime.js';

const provider = {
  generate: async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('Relevant project context:');
    expect(messages[0]?.content).toContain('auth.ts');
    expect(messages[1]?.role).toBe('user');
    return { content: 'done', finishReason: 'stop' as const, toolCalls: [] };
  },
};

const tools = {
  definitions: () => [],
  execute: async () => ({ content: '' }),
};

describe('AgentRuntime project context', () => {
  it('injects bounded project context before the user task', async () => {
    const runtime = new AgentRuntime(provider, tools as never, {
      projectContext: {
        retrieve: async () => ({
          files: [{ path: 'auth.ts', content: 'export function authenticate() {}', score: 8, tokensEstimate: 8 }],
          totalChars: 31,
          totalTokensEstimate: 8,
        }),
      },
    });

    await expect(
      runtime.run({ taskId: 'task-1', projectId: 'project-1', prompt: 'fix authentication timeout' }),
    ).resolves.toMatchObject({ content: 'done', finishReason: 'stop' });
  });
});
