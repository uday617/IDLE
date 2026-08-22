# Agent Self-Fix Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded, review-first repair loop that turns verification failures into structured agent repair proposals and stops after three repair attempts.

**Architecture:** Keep verification as the source of truth and add a small repair orchestrator around the existing task/ChangeSet flow. A failed verification becomes a bounded `FailureContext`; the agent receives it through the existing controlled proposal path and returns a ChangeSet proposal or no-repair result. Every proposal re-enters the existing review/apply boundary; the orchestrator owns the retry budget and never applies a repair automatically.

**Tech Stack:** TypeScript; existing runtime task/ChangeSet contracts; Vitest; existing provider/agent proposal abstractions; existing verification/apply services.

**Spec:** `docs/superpowers/specs/2026-08-22-agent-self-fix-loop-design.md`

## Global Constraints

- Maximum repair attempts are exactly 3 per task.
- Every repair proposal requires the existing user review gate before apply.
- Agents never receive unrestricted filesystem or shell access.
- Verification remains the source of truth for completion.
- Failure logs passed to the agent are bounded excerpts; full evidence remains inspectable through existing verification results.
- The retry counter must survive process restart when task state is persisted.
- A failed repair-analysis/proposal does not recursively consume an unbounded retry loop.

---

### Task 1: Add the failure-context contract

**Files:**
- Create: `packages/contracts/src/failure.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/failure.test.ts`

**Interfaces:**
- `FailureContext` with `taskId`, `attempt`, `checkId`, optional `exitCode`, bounded `stdoutExcerpt`, bounded `stderrExcerpt`, `affectedPaths`, `changeSetId`, and `previousAttempts`.
- `RepairOutcome = { kind: "changeset"; changeset: ChangeSet } | { kind: "no_repair_proposal"; reason: string }`.

- [ ] Write serialization tests for a representative failure and repair outcome.
- [ ] Add the contract and export it from the package index.
- [ ] Keep excerpt fields explicitly bounded by the normalization layer rather than trusting callers.
- [ ] Run `pnpm test --filter @idle/contracts` and `pnpm typecheck`.
- [ ] Commit `feat(contracts): add agent repair failure context`.

### Task 2: Normalize verification failures

**Files:**
- Create: `apps/runtime/src/agents/FailureContextBuilder.ts`
- Test: `apps/runtime/test/agents/FailureContextBuilder.test.ts`

**Interfaces:**
- `FailureContextBuilder.fromVerificationResult(input): FailureContext`
- `FailureContextBuilder.truncate(text, maxChars): string`

- [ ] Write tests proving success results cannot become repair contexts.
- [ ] Write tests for exit codes, check identifiers, paths, and bounded stdout/stderr excerpts.
- [ ] Implement deterministic normalization with a fixed excerpt limit of 8,000 characters per stream.
- [ ] Preserve the original verification result identifier so evidence remains traceable.
- [ ] Run the focused runtime test.
- [ ] Commit `feat(runtime): normalize verification failures for repair`.

### Task 3: Add bounded repair-loop state machine

**Files:**
- Create: `apps/runtime/src/agents/RepairLoop.ts`
- Test: `apps/runtime/test/agents/RepairLoop.test.ts`

**Interfaces:**
- `RepairLoop.MAX_REPAIR_ATTEMPTS = 3`
- `RepairLoop.start(taskId): RepairState`
- `RepairLoop.onVerificationFailure(state, failure): RepairDecision`
- `RepairLoop.onRepairProposal(state, outcome): RepairDecision`
- `RepairLoop.onVerificationSuccess(state): RepairDecision`

**State:**
- `verifying`
- `repair_pending`
- `review`
- `completed`
- `failed`

- [ ] Write a failing test for failure on attempt 1 producing `repair_pending`.
- [ ] Add tests proving attempts 1, 2, and 3 are allowed, while a fourth repair is rejected.
- [ ] Add tests for no-repair proposal and immediate verification success.
- [ ] Implement the pure state machine with no filesystem, provider, or UI dependencies.
- [ ] Run focused tests and typecheck.
- [ ] Commit `feat(runtime): add bounded repair loop state machine`.

### Task 4: Persist repair state with task state

**Files:**
- Modify: `apps/runtime/src/tasks/TaskService.ts`
- Modify: `apps/runtime/src/tasks/TaskRunner.ts`
- Test: `apps/runtime/test/tasks/TaskService.repair.test.ts`
- Test: `apps/runtime/test/tasks/TaskRunner.repair.test.ts`

**Interfaces:**
- Task state stores `repairAttempts`, `repairStatus`, and the latest `FailureContext` reference without storing unbounded logs.
- Task restart restores the retry counter and terminal status.

- [ ] Write a persistence test that starts a task, records two repair attempts, reconstructs the service, and verifies the count remains two.
- [ ] Add a test that a persisted count of three prevents another repair proposal.
- [ ] Wire the state machine into the existing task runner without changing the normal success path.
- [ ] Run focused task tests.
- [ ] Commit `feat(runtime): persist repair loop state`.

### Task 5: Connect verification failure to controlled repair proposals

**Files:**
- Modify: `apps/runtime/src/tasks/TaskRunner.ts`
- Modify: the existing agent proposal service under `apps/runtime/src/agents/` identified by the current ChangeSet proposal integration
- Test: `apps/runtime/test/tasks/TaskRunner.repair-integration.test.ts`

**Interfaces:**
- `TaskRunner` calls the existing controlled proposal interface with `FailureContext` when verification fails and repair attempts remain.
- Returned `ChangeSet` enters the existing review state; no apply call is made by the repair path.

- [ ] Write an integration test where verification fails and assert that exactly one repair proposal is produced and no apply operation occurs.
- [ ] Add a test that the original task context plus failure context is available to the proposal service.
- [ ] Wire the existing proposal engine/provider adapter without adding a second filesystem or shell tool surface.
- [ ] Ensure proposal failure becomes a terminal `failed` state when no repair proposal is available.
- [ ] Run the focused integration test.
- [ ] Commit `feat(runtime): route verification failures into repair proposals`.

### Task 6: Exercise review → apply → verify repair flow

**Files:**
- Create: `apps/runtime/test/agents/RepairLoop.integration.test.ts`
- Modify only the smallest existing ChangeSet review/apply integration seam required by the test

**Interfaces:**
- Deterministic integration harness simulates `ChangeSet -> review -> approve -> apply -> verification failure -> repair ChangeSet -> review -> approve -> apply -> verification success`.

- [ ] Write the end-to-end deterministic test with one failed initial verification and one successful repair.
- [ ] Assert the repair ChangeSet is distinct from the failed attempt and is not auto-applied.
- [ ] Assert success terminates the loop immediately.
- [ ] Add a second scenario that fails three repair attempts and ends in `failed` without a fourth proposal.
- [ ] Run the integration test and the complete runtime test suite.
- [ ] Commit `test(runtime): cover review gated self-fix loop`.

### Task 7: Full verification and PR

**Files:**
- No new production files unless required by failing tests.
- Optional: `docs/` update only if the public runtime workflow documentation needs the new repair state.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run the existing package/build checks used by CI.
- [ ] Review the final diff for accidental direct mutation paths and unbounded retry behavior.
- [ ] Push the branch and open a PR into `main`.
- [ ] Do not merge until all required checks are green.
