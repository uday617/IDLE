import { describe, expect, it } from 'vitest';
import type { FailureContext } from '@idle/contracts';
import { AgentRuntime } from '../src/agents/AgentRuntime.js';
import type { LLMResponse } from '../src/agents/llm/LLMProvider.js';
import { RepairAgent } from '../src/agents/RepairAgent.js';
import { ToolRegistry } from '../src/agents/tools/ToolRegistry.js';
import { createRuntimeServer } from '../src/ipc/server.js';

class DeterministicRepairProvider {
  async generate(): Promise<LLMResponse> {
    return {
      content: 'Replace line "const broken = true;" with "const broken = false;" in file "fixture/bug.ts"',
      toolCalls: [],
      finishReason: 'stop',
    };
  }
}

const failure: FailureContext = {
  taskId: 'task-runtime-repair' as never,
  attempt: 1,
  checkId: 'fixture-check',
  stdoutExcerpt: 'expected false',
  stderrExcerpt: '',
  affectedPaths: ['fixture/bug.ts'],
  previousAttempts: [],
};

describe('runtime repair entrypoint', () => {
  it('turns a verification failure into a reviewable repair decision', async () => {
    const repairAgent = new RepairAgent(
      new AgentRuntime(new DeterministicRepairProvider(), new ToolRegistry()),
    );
    const server = createRuntimeServer('test', { repairAgent });
    await server.start();

    const project = await server.handleProject({ type: 'project.open', path: process.cwd() });
    await server.submitTask({
      taskId: 'task-runtime-repair' as never,
      projectId: project.id,
      prompt: 'repair the fixture failure',
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await server.getTask('task-runtime-repair')) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const decision = await server.repairTask(
      'task-runtime-repair',
      failure,
      [{ path: 'fixture/bug.ts', content: 'const broken = true;\n' }],
    );

    expect(decision.kind).toBe('await_review');
    if (decision.kind === 'await_review') {
      expect(decision.changeSetId).toBe('proposal-task-runtime-repair-repair-1');
    }

    await server.stop();
  });
});
