import { describe, expect, it, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/AgentExecutor.js';
import type { AgentRuntime } from '../../src/agents/AgentRuntime.js';

describe('AgentExecutor', () => {
  it('routes an inspected task through AgentRuntime without applying changes', async () => {
    const runtime = {
      run: vi.fn(async () => ({
        taskId: 'task-1',
        content: 'propose adding auth middleware',
        finishReason: 'stop' as const,
        turns: 1,
      })),
    } as unknown as AgentRuntime;
    const projects = {
      get: vi.fn(async () => ({ id: 'project-1', path: '/workspace/app' })),
    };
    const files = {
      list: vi.fn(async () => [{ name: 'src', kind: 'directory' }]),
      readState: vi.fn(async () => ({ exists: true, content: '{"name":"demo"}' })),
    };
    const executor = new AgentExecutor(projects as never, files as never, runtime);

    const result = await executor.executeAgent({
      id: 'task-1',
      projectId: 'project-1',
      prompt: 'add auth',
    });

    expect(runtime.run).toHaveBeenCalledWith({
      taskId: 'task-1',
      projectId: 'project-1',
      prompt: 'add auth',
    });
    expect(result.agent).toMatchObject({
      taskId: 'task-1',
      content: 'propose adding auth middleware',
      finishReason: 'stop',
    });
    expect(files.readState).toHaveBeenCalledTimes(1);
  });
});
