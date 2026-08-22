import { describe, expect, it } from 'vitest';
import type { FailureContext } from '@idle/contracts';
import { AgentRuntime } from '../../src/agents/AgentRuntime.js';
import type { LLMRequest, LLMResponse } from '../../src/agents/llm/LLMProvider.js';
import { RepairAgent } from '../../src/agents/RepairAgent.js';
import { ToolRegistry } from '../../src/agents/tools/ToolRegistry.js';

class DeterministicRepairProvider {
  lastRequest?: LLMRequest;

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.lastRequest = request;
    return {
      content: 'Replace line "const broken = true;" with "const broken = false;" in file "fixture/bug.ts"',
      toolCalls: [],
      finishReason: 'stop',
    };
  }
}

const failure: FailureContext = {
  taskId: 'task-repair' as never,
  attempt: 1,
  checkId: 'fixture-check',
  stdoutExcerpt: 'expected false',
  stderrExcerpt: '',
  affectedPaths: ['fixture/bug.ts'],
  previousAttempts: [],
};

describe('RepairAgent proposal generation', () => {
  it('turns a model repair response into a reviewable ChangeSet', async () => {
    const provider = new DeterministicRepairProvider();
    const runtime = new AgentRuntime(provider, new ToolRegistry());
    const agent = new RepairAgent(runtime);

    const outcome = await agent.propose({
      taskId: 'task-repair',
      projectId: 'fixture-project',
      goal: 'repair the intentional fixture failure',
      failure,
      files: [{ path: 'fixture/bug.ts', content: 'const broken = true;\n' }],
    });

    expect(outcome.kind).toBe('changeset');
    if (outcome.kind !== 'changeset') return;
    expect(outcome.changeset.changes).toHaveLength(1);
    expect(outcome.changeset.changes[0]).toMatchObject({
      operation: 'modify',
      path: 'fixture/bug.ts',
    });
    expect(provider.lastRequest?.messages.at(-1)?.content).toContain('expected false');
  });
});
