# Multi-Agent Orchestration V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax and each task ends with an independently testable checkpoint.

**Goal:** Add a configurable, safe multi-agent coordinator with a default concurrency of two, path-level conflict detection, deterministic ChangeSet aggregation, and reuse of the existing review/apply/verify/repair pipeline.

**Architecture:** Add orchestration above the existing provider-independent agent runtime. A deterministic `TaskDecomposer` creates bounded subtasks, `MultiAgentCoordinator` schedules them under a configurable max of four (default two), `CoordinationStateStore` records lifecycle/ownership, `ConflictDetector` prevents incompatible ChangeSets from being aggregated, and `ChangeSetAggregator` creates one reviewable ChangeSet. Existing secure tools, ChangeSet review, apply, verification, rollback, and repair remain unchanged.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, existing runtime/contracts packages, existing AgentRuntime/ChangeSet infrastructure.

**Spec:** `docs/superpowers/specs/2026-08-23-multi-agent-orchestration-v1-design.md`

## Global Constraints

- Default maximum concurrent agents: 2.
- Hard configurable maximum: 4.
- Existing single-agent execution remains the fallback.
- Agents use existing controlled tools and secure execution boundaries.
- Coordination uses structured state/events, not unrestricted direct messaging.
- Conflicts are explicit; no silent overwrite or implicit merge.
- Aggregated ChangeSets continue through the existing review/apply/verify/repair boundary.
- V1 does not add Git worktrees or line-level semantic merge.

---

### Task 1: Add orchestration contracts

**Files:**
- Modify: `packages/contracts/src/agent.ts`
- Modify: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/contracts.test.ts`

**Interfaces:**
- `AgentSubtask { id: string; parentTaskId: TaskId; prompt: string; claimedPaths?: string[] }`
- `MultiAgentConfig { defaultMaxAgents: number; hardMaxAgents: number }`
- `AgentRunStatus = queued | running | completed | failed | cancelled | conflict`
- `AgentRunRecord { subtaskId; agentId; status; claimedPaths; changeSetId?; error? }`
- `CoordinationEvent { id; timestamp; taskId; type; payload }`

- [ ] Write failing contract tests for serialization-compatible records and defaults of 2/4.
- [ ] Run `pnpm --filter @idle/contracts test` and confirm the new tests fail for missing types.
- [ ] Add the minimal contracts and exports without changing existing task/agent status values.
- [ ] Run `pnpm --filter @idle/contracts test` and `pnpm --filter @idle/contracts typecheck`; expect PASS.
- [ ] Commit `feat(contracts): add multi-agent orchestration contracts`.

### Task 2: Implement bounded deterministic task decomposition

**Files:**
- Create: `apps/runtime/src/orchestration/TaskDecomposer.ts`
- Test: `apps/runtime/src/orchestration/TaskDecomposer.test.ts`

**Interfaces:**
- `TaskDecomposer.decompose(taskId: TaskId, prompt: string): AgentSubtask[]`
- `TaskDecomposer` returns at most configured `maxAgents` subtasks and returns one subtask when decomposition is not provably independent.

- [ ] Write failing tests for one-task fallback, two independent subtasks, and max-agent clamping.
- [ ] Run `pnpm --filter @idle/runtime exec vitest run src/orchestration/TaskDecomposer.test.ts`; expect FAIL.
- [ ] Implement deterministic decomposition using explicit independent-task markers/structured input; do not invoke a second LLM in this task.
- [ ] Run the focused test; expect PASS.
- [ ] Commit `feat(runtime): add bounded multi-agent task decomposition`.

### Task 3: Implement coordination state and lifecycle events

**Files:**
- Create: `apps/runtime/src/orchestration/CoordinationStateStore.ts`
- Create: `apps/runtime/src/orchestration/CoordinationEventEmitter.ts`
- Test: `apps/runtime/src/orchestration/CoordinationStateStore.test.ts`

**Interfaces:**
- `CoordinationStateStore.create(taskId, subtasks): CoordinationState`
- `CoordinationStateStore.start(subtaskId, agentId): void`
- `CoordinationStateStore.claimPaths(subtaskId, paths): void`
- `CoordinationStateStore.complete(subtaskId, changeSetId): void`
- `CoordinationStateStore.fail(subtaskId, error): void`
- `CoordinationStateStore.conflict(subtaskIds, paths): void`
- `CoordinationEventEmitter.on(listener): () => void`

- [ ] Write failing tests for legal lifecycle transitions and invalid transitions.
- [ ] Run the focused test; expect FAIL.
- [ ] Implement an in-memory store with immutable snapshots returned to callers.
- [ ] Emit structured events for create/start/claim/complete/fail/conflict.
- [ ] Run the focused test and runtime typecheck; expect PASS.
- [ ] Commit `feat(runtime): add multi-agent coordination state`.

### Task 4: Add path ownership and conflict detection

**Files:**
- Create: `apps/runtime/src/orchestration/ConflictDetector.ts`
- Test: `apps/runtime/src/orchestration/ConflictDetector.test.ts`

**Interfaces:**
- `ConflictDetector.detect(runs: AgentRunRecord[]): ConflictReport`
- `ConflictReport { conflicts: Array<{ subtaskIds: string[]; paths: string[] }> }`

- [ ] Write failing tests for disjoint paths, identical paths, normalized equivalent paths, and one subtask with no claimed paths.
- [ ] Run the focused test; expect FAIL.
- [ ] Implement normalized project-relative path comparison and deterministic conflict ordering.
- [ ] Run the focused test; expect PASS.
- [ ] Commit `feat(runtime): add multi-agent conflict detection`.

### Task 5: Implement deterministic ChangeSet aggregation

**Files:**
- Create: `apps/runtime/src/orchestration/ChangeSetAggregator.ts`
- Test: `apps/runtime/src/orchestration/ChangeSetAggregator.test.ts`

**Interfaces:**
- `ChangeSetAggregator.aggregate(changeSets: ChangeSet[]): ChangeSet`

- [ ] Write failing tests for empty input, one ChangeSet identity, compatible multiple ChangeSets, and conflict rejection.
- [ ] Run the focused test; expect FAIL.
- [ ] Implement deterministic file ordering and preservation of each ChangeSet's metadata/operations.
- [ ] Reject aggregation when `ConflictDetector` reports overlapping targets.
- [ ] Run the focused test and existing ChangeSet tests; expect PASS.
- [ ] Commit `feat(runtime): add multi-agent changeset aggregation`.

### Task 6: Implement the coordinator with bounded concurrency

**Files:**
- Create: `apps/runtime/src/orchestration/MultiAgentCoordinator.ts`
- Test: `apps/runtime/src/orchestration/MultiAgentCoordinator.test.ts`

**Interfaces:**
- `MultiAgentCoordinator.run(task: AgentTask, config?: MultiAgentConfig): Promise<CoordinationResult>`
- `CoordinationResult { status; runs; combinedChangeSet?; conflicts; failures }`

- [ ] Write failing tests proving default concurrency is 2, hard cap is 4, cancellation is propagated, and a subtask failure prevents aggregation.
- [ ] Run the focused test; expect FAIL.
- [ ] Inject the existing agent execution boundary instead of constructing provider/runtime implementations inside the coordinator.
- [ ] Schedule subtasks with a small worker queue capped at `min(config.maxAgents, 4)`.
- [ ] Record each run through `CoordinationStateStore` and route completed ChangeSets through `ChangeSetAggregator`.
- [ ] Run the focused coordinator tests; expect PASS.
- [ ] Commit `feat(runtime): add bounded multi-agent coordinator`.

### Task 7: Integrate coordinator with the existing task runtime

**Files:**
- Modify: `apps/runtime/src/tasks/TaskRunner.ts`
- Modify: `apps/runtime/src/ipc/server.ts`
- Test: `apps/runtime/test/agents/MultiAgentRuntime.test.ts`

**Interfaces:**
- Existing single-agent task submission remains unchanged.
- Multi-agent mode is opt-in through task/runtime configuration and falls back to the existing single-agent path when disabled.

- [ ] Write a failing integration test that submits an orchestration-enabled task with two injected fake agents and expects one combined ChangeSet.
- [ ] Run the focused integration test; expect FAIL.
- [ ] Wire the coordinator at the task execution boundary without changing existing single-agent lifecycle behavior.
- [ ] Expose structured coordination events through the existing IPC event path.
- [ ] Run the integration test plus the existing runtime task tests; expect PASS.
- [ ] Commit `feat(runtime): integrate multi-agent coordination into tasks`.

### Task 8: Add end-to-end conflict and regression coverage

**Files:**
- Create: `apps/runtime/test/orchestration/multi-agent.e2e.test.ts`
- Modify: `apps/runtime/test/real-repair.e2e.test.ts` only if a shared fixture helper is needed.

**Interfaces:**
- End-to-end test uses fake agent executors for deterministic CI and asserts the existing review/apply/verify boundary remains the integration point.

- [ ] Write a failing E2E test for two compatible agents producing a combined ChangeSet.
- [ ] Write a failing E2E test for two agents targeting the same file and assert conflict without aggregation.
- [ ] Write a regression test for single-agent execution through the same coordinator configuration with maxAgents=1.
- [ ] Run the focused E2E tests; expect FAIL.
- [ ] Implement only the fixture wiring required by the production interfaces; do not weaken assertions.
- [ ] Run all runtime tests and typecheck; expect PASS.
- [ ] Commit `test(runtime): cover multi-agent orchestration end to end`.

### Task 9: Final verification and PR

**Files:**
- Modify: documentation only if existing orchestration docs need an implementation-status update.

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run the existing Nemotron real-agent smoke workflow as a regression check.
- [ ] Review the diff for accidental changes to the single-agent path, security boundary, or repair pipeline.
- [ ] Push the feature branch and open a PR against `main` with a summary of orchestration, conflict behavior, and verification evidence.
- [ ] Do not merge until CI, Windows Package, and Nemotron Real E2E are green.
