import { describe, expect, it } from 'vitest';
import type { FailureContext } from '@idle/contracts';
import { AgentRuntime } from '../../src/agents/AgentRuntime.js';
import type { LLMResponse } from '../../src/agents/llm/LLMProvider.js';
import { RepairAgent } from '../../src/agents/RepairAgent.js';
import { RepairCoordinator } from '../../src/agents/RepairCoordinator.js';
import { ToolRegistry } from '../../src/agents/tools/ToolRegistry.js';
import { TaskService } from '../../src/tasks/TaskService.js';

class RepairProvider {
  async generate(): Promise<LLMResponse> {
    return {
      content: 'Replace line "const broken = true;" with "const broken = false;" in file "fixture/bug.ts"',
      toolCalls: [],
      finishReason: 'stop',
    };
  }
}

const failure: FailureContext = {
  taskId: 'task-coordinated-repair' as never,
  attempt: 1,
  checkId: 'fixture-check',
  stdoutExcerpt: 'expected false',
  stderrExcerpt: '',
  affectedPaths: ['fixture/bug.ts'],
  previousAttempts: [],
};

describe('RepairCoordinator model-backed repair', () => {
  it('turns a verification failure into a review decision through RepairAgent', async () => {
    const tasks = new TaskService();
    await tasks.create('task-coordinated-repair', 'fixture-project', 'repair the fixture failure');
    const agent = new RepairAgent(new AgentRuntime(new RepairProvider(), new ToolRegistry()));
    const coordinator = new RepairCoordinator(tasks, { repairAgent: agent });

    coordinator.start('task-coordinated-repair');
    const decision = await coordinator.onVerificationFailureAndPropose(
      'task-coordinated-repair',
      failure,
      [{ path: 'fixture/bug.ts', content: 'const broken = true;\n' }],
    );

    expect(decision.kind).toBe('await_review');
    expect(decision.changeSetId).toBe('proposal-task-coordinated-repair-repair-1');
    expect(tasks.get('task-coordinated-repair')?.repairStatus).toBe('review');
  });
});
