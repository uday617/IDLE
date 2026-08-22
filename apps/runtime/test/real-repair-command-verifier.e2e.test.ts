import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  taskId: 'task-command-verifier' as never,
  attempt: 1,
  checkId: 'fixture-check',
  stdoutExcerpt: 'expected false',
  stderrExcerpt: '',
  affectedPaths: ['fixture/bug.ts'],
  previousAttempts: [],
};

describe('command-backed repair verification', () => {
  it('applies a reviewed repair and verifies it with the secure command executor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-command-repair-'));
    const fixturePath = join(root, 'fixture', 'bug.ts');
    await mkdir(join(root, 'fixture'), { recursive: true });
    await writeFile(fixturePath, 'const broken = true;\n', 'utf8');

    const repairAgent = new RepairAgent(
      new AgentRuntime(new DeterministicRepairProvider(), new ToolRegistry()),
    );
    const server = createRuntimeServer('test', {
      repairAgent,
      repairVerification: {
        command: 'node -e process.exit(require("node:fs").readFileSync("fixture/bug.ts","utf8").includes("false")?0:1)',
        checkId: 'fixture-command-check',
        policy: { allowedCommands: ['node'] },
        affectedPaths: ['fixture/bug.ts'],
      },
    });

    try {
      await server.start();
      const project = await server.handleProject({ type: 'project.open', path: root });
      await server.submitTask({
        taskId: 'task-command-verifier' as never,
        projectId: project.id,
        prompt: 'repair the fixture failure',
      });

      const decision = await server.repairTask('task-command-verifier', failure, [
        { path: 'fixture/bug.ts', content: 'const broken = true;\n' },
      ]);
      expect(decision.kind).toBe('await_review');
      if (decision.kind !== 'await_review') throw new Error('expected repair review');

      const result = await server.applyRepair('task-command-verifier', decision.changeSetId);
      expect(result.kind).toBe('completed');
      expect(await readFile(fixturePath, 'utf8')).toBe('const broken = false;\n');
    } finally {
      await server.stop();
      await rm(root, { recursive: true, force: true });
    }
  });
});
