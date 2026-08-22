# Agent Provider Execution Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing provider-independent `AgentRuntime` boundary into a bounded multi-turn executor that normalizes tool calls, dispatches only allowlisted tools, feeds tool results back to the provider, and returns controlled failures without applying project changes.

**Architecture:** `AgentRuntime` owns conversation state and the configurable eight-turn limit. `LLMProvider` exposes provider-neutral messages, tool definitions, normalized tool calls, and normalized finish reasons; `ToolRegistry` is the allowlist and validation boundary before execution. Existing `SecurityPolicy`/`ToolExecutor` and ChangeSet review/apply paths remain outside this loop, so the model cannot directly mutate files or execute unrestricted commands.

**Tech Stack:** TypeScript, Node.js runtime, Vitest, existing IDLE agent/tool/security services.

**Spec:** `docs/superpowers/specs/2026-08-22-agent-provider-execution-design.md`

## Global Constraints

- `AgentRuntime` default `maxTurns` is exactly `8` and must be configurable for tests.
- Provider adapters return only the normalized `LLMResponse` contract; runtime code must not depend on provider-specific response types.
- Unknown tools and invalid argument shapes are controlled tool errors and never fall through to arbitrary command execution.
- Command-capable tools delegate to the existing `ToolExecutor` and `SecurityPolicy` path.
- Change creation remains review-first; the agent loop never applies a ChangeSet automatically.
- Provider/tool failures become structured task-level failures or tool-result messages rather than renderer-bound exceptions.
- CI uses fake providers only; no network access or secrets are required.

---

### Task 1: Align provider and tool contracts

**Files:**
- Modify: `apps/runtime/src/agents/llm/LLMProvider.ts`
- Modify: `apps/runtime/src/agents/tools/ToolRegistry.ts`
- Test: `apps/runtime/test/agents/AgentRuntime.test.ts`

**Interfaces:**
- `LLMMessage` gains the `tool` role and optional `toolCallId`.
- `LLMToolDefinition` exposes `name`, `description`, and `parameters`.
- `LLMToolCall` is `{ id: string; name: string; arguments: Record<string, unknown> }`.
- `LLMResponse` is `{ content: string; toolCalls: LLMToolCall[]; finishReason: 'stop' | 'tool_calls' | 'length' | 'error' }`.
- `LLMRequest` is `{ messages: LLMMessage[]; tools: LLMToolDefinition[] }`.
- `AgentToolContext` is `{ projectId: string; taskId: string }`.
- `AgentToolDefinition.execute(arguments_, context)` returns `Promise<{ content: string }>`.
- `ToolRegistry.definitions()` returns the normalized provider definitions and `ToolRegistry.execute(call, context)` resolves only registered tools.

- [ ] **Step 1: Write failing contract tests**

```ts
it('normalizes tool definitions and tool-role messages', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'read_file',
    description: 'Read a project file',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    execute: async () => ({ content: 'ok' }),
  });

  expect(registry.definitions()).toEqual([
    {
      name: 'read_file',
      description: 'Read a project file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    },
  ]);
  await registry.execute(
    { id: 'call-1', name: 'read_file', arguments: { path: 'src/index.ts' } },
    { projectId: 'p1', taskId: 't1' },
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @idle/runtime test -- AgentRuntime.test.ts`
Expected: FAIL because the current provider/tool contracts use `LLMGenerateRequest`, `LLMGenerateResponse`, `inputSchema`, and do not expose registry execution/context.

- [ ] **Step 3: Implement the normalized contracts**

Use the exact interfaces in the Interfaces section. Map the existing `inputSchema` field to `parameters`, preserve registration duplicate protection, and make `ToolRegistry.execute()` reject unknown names with `Unknown tool: <name>` rather than attempting any fallback.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm --filter @idle/runtime test -- AgentRuntime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/runtime/src/agents/llm/LLMProvider.ts apps/runtime/src/agents/tools/ToolRegistry.ts apps/runtime/test/agents/AgentRuntime.test.ts
git commit -m "refactor(runtime): normalize agent execution contracts"
```

---

### Task 2: Implement the bounded multi-turn AgentRuntime

**Files:**
- Modify: `apps/runtime/src/agents/AgentRuntime.ts`
- Test: `apps/runtime/test/agents/AgentRuntime.test.ts`

**Interfaces:**
- `AgentRuntimeOptions` is `{ maxTurns?: number }`.
- `AgentRunRequest` is `{ taskId: string; projectId: string; prompt: string }`.
- `AgentRunResult` is `{ taskId: string; content: string; finishReason: 'stop' | 'tool_calls' | 'length' | 'error'; turns: number; error?: string }`.
- `AgentRuntime.run(request: AgentRunRequest): Promise<AgentRunResult>` sends accumulated messages and registered tool definitions to the provider.

- [ ] **Step 1: Write failing tests for the loop**

```ts
it('finishes in one turn on final text', async () => {
  const provider = fakeProvider({ content: 'done', toolCalls: [], finishReason: 'stop' });
  const runtime = new AgentRuntime(provider, new ToolRegistry());
  await expect(runtime.run({ taskId: 't1', projectId: 'p1', prompt: 'inspect' })).resolves.toMatchObject({
    taskId: 't1', content: 'done', finishReason: 'stop', turns: 1,
  });
});

it('feeds tool results into the next provider turn', async () => {
  const provider = sequenceProvider([
    { content: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'a.ts' } }], finishReason: 'tool_calls' },
    { content: 'found it', toolCalls: [], finishReason: 'stop' },
  ]);
  const registry = registryWithTool('read_file', async () => ({ content: 'file contents' }));
  const runtime = new AgentRuntime(provider, registry);

  await runtime.run({ taskId: 't2', projectId: 'p1', prompt: 'find it' });
  expect(provider.requests[1].messages.at(-1)).toEqual({ role: 'tool', content: 'file contents', toolCallId: 'c1' });
});
```

- [ ] **Step 2: Add failure/limit tests**

```ts
it('rejects unknown tools without executing anything', async () => {
  const execute = vi.fn();
  const registry = registryWithTool('read_file', execute);
  const provider = fakeProvider({ content: '', toolCalls: [{ id: 'c1', name: 'delete_everything', arguments: {} }], finishReason: 'tool_calls' });
  const result = await new AgentRuntime(provider, registry).run({ taskId: 't3', projectId: 'p1', prompt: 'x' });
  expect(result.finishReason).toBe('error');
  expect(result.error).toContain('Unknown tool');
  expect(execute).not.toHaveBeenCalled();
});

it('stops after maxTurns without an unbounded retry loop', async () => {
  const provider = repeatingToolProvider();
  const runtime = new AgentRuntime(provider, registryWithTool('inspect', async () => ({ content: 'ok' })), { maxTurns: 2 });
  const result = await runtime.run({ taskId: 't4', projectId: 'p1', prompt: 'loop' });
  expect(result.finishReason).toBe('length');
  expect(result.turns).toBe(2);
  expect(provider.calls).toBe(2);
});
```

- [ ] **Step 3: Run tests to verify the new behavior fails**

Run: `pnpm --filter @idle/runtime test -- AgentRuntime.test.ts`
Expected: FAIL because the current runtime performs only one provider call and never executes/feeds tool calls.

- [ ] **Step 4: Implement the minimal loop**

Initialize messages with the user prompt. For each turn up to `maxTurns`, call `provider.generate({ messages, tools })`. On `stop`, return success. On tool calls, execute every call through `ToolRegistry.execute({ ... }, { projectId, taskId })`, append the assistant message followed by one `tool` message per result, and continue. Convert provider/tool exceptions to `finishReason: 'error'`. If the bound is exhausted, return `finishReason: 'length'` without applying changes.

- [ ] **Step 5: Run focused tests**

Run: `pnpm --filter @idle/runtime test -- AgentRuntime.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/runtime/src/agents/AgentRuntime.ts apps/runtime/test/agents/AgentRuntime.test.ts
git commit -m "feat(runtime): add bounded agent tool loop"
```

---

### Task 3: Harden malformed responses and security boundaries

**Files:**
- Modify: `apps/runtime/src/agents/AgentRuntime.ts`
- Modify: `apps/runtime/src/agents/tools/ToolRegistry.ts`
- Test: `apps/runtime/test/agents/AgentRuntime.test.ts`
- Test: `apps/runtime/test/agents/tools/ToolRegistry.test.ts` (create if the focused registry tests are not already split out)

**Interfaces:**
- Tool arguments must be a non-null object before a registered tool executes.
- Tool execution errors are returned as tool messages when the loop can continue, while provider errors become task-level `error` results.
- `AgentRuntime` never calls `FileService`, `fs`, `child_process`, or ChangeSet apply APIs directly.

- [ ] **Step 1: Write failing security/error tests**

```ts
it('turns malformed tool arguments into a controlled tool result', async () => {
  const provider = sequenceProvider([
    { content: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: null as never }], finishReason: 'tool_calls' },
    { content: 'cannot read', toolCalls: [], finishReason: 'stop' },
  ]);
  const runtime = new AgentRuntime(provider, registryWithTool('read_file', async () => ({ content: 'should not run' })));
  const result = await runtime.run({ taskId: 't5', projectId: 'p1', prompt: 'read' });
  expect(result.content).toBe('cannot read');
  expect(provider.requests[1].messages.at(-1)?.content).toContain('Invalid arguments');
});

it('converts provider failure to a controlled task result', async () => {
  const provider = { generate: vi.fn().mockRejectedValue(new Error('provider unavailable')) };
  const result = await new AgentRuntime(provider, new ToolRegistry()).run({ taskId: 't6', projectId: 'p1', prompt: 'x' });
  expect(result).toMatchObject({ finishReason: 'error', error: 'provider unavailable', turns: 1 });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @idle/runtime test -- AgentRuntime.test.ts`
Expected: FAIL because malformed arguments and provider failures are not yet normalized into the specified controlled results.

- [ ] **Step 3: Add argument validation and controlled error messages**

Reject `null`, arrays, and non-object tool arguments before lookup execution. For a tool failure, append `{ role: 'tool', content: 'Tool <name> failed: <message>', toolCallId }` and continue only when another provider turn remains. Never invoke a command fallback for an unknown or malformed tool.

- [ ] **Step 4: Verify the security boundary with the existing command executor**

Use the existing `ToolExecutor` in the test fixture as the implementation behind a command-capable registered tool and assert the registry invokes that injected executor rather than `child_process` directly. Keep the agent runtime unaware of the executor implementation.

- [ ] **Step 5: Run runtime typecheck and tests**

Run: `pnpm --filter @idle/runtime typecheck && pnpm --filter @idle/runtime test`
Expected: PASS with no network calls.

- [ ] **Step 6: Commit**

```bash
git add apps/runtime/src/agents/AgentRuntime.ts apps/runtime/src/agents/tools/ToolRegistry.ts apps/runtime/test/agents/AgentRuntime.test.ts apps/runtime/test/agents/tools/ToolRegistry.test.ts
git commit -m "test(runtime): harden agent tool execution boundary"
```

---

### Task 4: Integrate the loop without automatic ChangeSet application

**Files:**
- Modify: `apps/runtime/src/agents/AgentExecutor.ts`
- Modify: `apps/runtime/src/agents/AgentContext.ts`
- Test: `apps/runtime/test/agents/AgentRuntime.test.ts`
- Test: existing `apps/runtime/test/agents/AgentExecutor.test.ts` if present

**Interfaces:**
- Existing `AgentExecutor` remains the task-facing integration point.
- It may call `AgentRuntime.run({ taskId, projectId, prompt })` and translate the returned result into the existing task result/change-review flow.
- It must not call a ChangeSet apply method as a side effect of an agent response.

- [ ] **Step 1: Write the integration regression test**

```ts
it('returns an agent proposal without applying project changes', async () => {
  const apply = vi.fn();
  const runtime = new AgentRuntime(fakeProvider({
    content: 'propose adding auth middleware', toolCalls: [], finishReason: 'stop',
  }), new ToolRegistry());
  const executor = createAgentExecutor({ runtime, applyChangeSet: apply });

  const result = await executor.execute({ taskId: 't7', projectId: 'p1', prompt: 'add auth' });

  expect(result.content).toContain('auth');
  expect(apply).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the regression test to verify it fails**

Run: `pnpm --filter @idle/runtime test -- AgentExecutor.test.ts AgentRuntime.test.ts`
Expected: FAIL if the current executor does not yet route the provider-backed runtime result through its existing review-first boundary.

- [ ] **Step 3: Wire the runtime result into the existing executor**

Pass only `taskId`, `projectId`, and prompt/context into `AgentRuntime`; preserve the existing ChangeSet builder/review path for future proposal conversion. Do not add a direct write/apply call.

- [ ] **Step 4: Run full runtime verification**

Run: `pnpm --filter @idle/runtime typecheck && pnpm --filter @idle/runtime test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/runtime/src/agents/AgentExecutor.ts apps/runtime/src/agents/AgentContext.ts apps/runtime/test/agents
git commit -m "feat(runtime): integrate bounded provider agent loop"
```

---

### Task 5: Final verification and pull request

**Files:**
- Modify: `docs/superpowers/plans/2026-08-22-agent-provider-execution-loop.md` (check off completed tasks)

- [ ] **Step 1: Run workspace typecheck**

Run: `pnpm typecheck`
Expected: PASS for all workspace projects.

- [ ] **Step 2: Run workspace tests**

Run: `pnpm test`
Expected: PASS with the complete existing suite plus the new agent-loop coverage.

- [ ] **Step 3: Check the diff for forbidden behavior**

Confirm the diff contains no provider API key, network client, direct `fs` mutation, direct `child_process` invocation, automatic ChangeSet apply, or unbounded retry loop in `AgentRuntime`.

- [ ] **Step 4: Commit the completed plan state**

```bash
git add docs/superpowers/plans/2026-08-22-agent-provider-execution-loop.md
git commit -m "docs: complete agent provider execution loop plan"
```

- [ ] **Step 5: Open the pull request**

```bash
git push -u origin feat/agent-provider-execution-loop
gh pr create --base main --head feat/agent-provider-execution-loop --title "feat(runtime): add bounded provider agent loop" --body "Implements the approved agent provider execution design with normalized provider/tool contracts, bounded multi-turn tool execution, controlled failures, and review-first integration."
```

## Self-Review

- **Spec coverage:** Contract normalization is Task 1; bounded loop is Task 2; malformed responses, unknown tools, and security enforcement are Task 3; review-first integration is Task 4; CI/no-network verification is Task 5.
- **Placeholder scan:** No TBD/TODO or unspecified implementation steps are used.
- **Type consistency:** `LLMResponse`/`LLMRequest` are established in Task 1 and consumed by the loop in Task 2; `AgentToolContext` and `ToolRegistry.execute()` are established in Task 1 and consumed by Tasks 2-3; `AgentRunRequest`/`AgentRunResult` are established in Task 2 and consumed by Task 4.
- **Non-goals preserved:** No real provider credentials, no automatic ChangeSet application, no unrestricted shell access, and no multi-agent orchestration are introduced by this plan.
