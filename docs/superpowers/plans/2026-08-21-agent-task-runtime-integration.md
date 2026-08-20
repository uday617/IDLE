# Agent Task Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing Quick Task UI to the runtime task lifecycle and safely expose agent execution progress/results without bypassing existing security, recovery, ChangeSet, or review boundaries.

**Architecture:** Keep the renderer as a thin client. Add one typed IPC command/event boundary for task submission and task-state updates, then let the runtime own task creation, execution, checkpointing, failure/recovery, and result reporting. Tool execution continues through `SecurityPolicy`/`ToolExecutor`; changes continue through the existing ChangeSet/workspace review path rather than being written directly from the UI.

**Tech Stack:** React, TypeScript, Electron IPC, Vitest, existing runtime TaskService/AgentRequestService/ToolExecutor/ChangeSet services.

**Spec:** Existing agent-first UI/UX and runtime foundation in `main`; the UI currently explicitly says Quick Task is ready for the runtime execution layer and does not fabricate execution behavior. fileciteturn211file0L8-L14

## Global Constraints

- Preserve existing security-policy boundaries; no direct renderer shell execution.
- Preserve task persistence/checkpoint/recovery semantics in `TaskService`.
- Preserve ChangeSet preview/review/apply semantics; no renderer-side direct file mutation.
- Preserve existing Electron IPC conventions and typed contracts.
- Keep Windows packaging/build green.
- Do not introduce a provider-specific LLM implementation as part of this integration.

---

### Task 1: Map and define the task IPC contract

**Files:**
- Create: `packages/contracts/src/tasks.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/tasks.test.ts`

**Interfaces:**
- Produces `TaskSubmitRequest`, `TaskSubmitResult`, `TaskStatusEvent`, and `TaskResult` types consumed by runtime and desktop.
- Uses the existing task statuses: `pending | running | paused | completed | failed`.

- [ ] **Step 1: Write failing contract tests** covering valid task submission, status events, and completed/failed results.
- [ ] **Step 2: Run `pnpm --filter @idle/contracts test` and confirm the new tests fail because the types do not exist.**
- [ ] **Step 3: Implement the minimal exported types and add them to the contracts index.**
- [ ] **Step 4: Run `pnpm --filter @idle/contracts test` and confirm all contract tests pass.**
- [ ] **Step 5: Commit with `feat: define task execution ipc contracts`.**

### Task 2: Add runtime task orchestration boundary

**Files:**
- Create: `apps/runtime/src/tasks/TaskRunner.ts`
- Test: `apps/runtime/test/tasks/TaskRunner.test.ts`

**Interfaces:**
- `TaskRunner.submit(request): Promise<TaskRecord>` creates a task and starts execution.
- `TaskRunner.subscribe(listener): () => void` emits `TaskStatusEvent` updates.
- `TaskRunner.getResult(id): TaskResult | undefined` returns the latest result.
- `TaskRunner` consumes `TaskService`; execution is injected so tests never call a real shell/provider.

- [ ] **Step 1: Write failing tests for pending → running → completed and pending → running → failed transitions.**
- [ ] **Step 2: Run the focused TaskRunner tests and confirm failure.**
- [ ] **Step 3: Implement TaskRunner using `TaskService.create/start/complete/fail/checkpoint`; `TaskService` already owns persistence and recovery. fileciteturn207file0L2-L2**
- [ ] **Step 4: Emit immutable status events after every persisted transition and return a structured result.**
- [ ] **Step 5: Run focused runtime tests and confirm pass.**
- [ ] **Step 6: Commit with `feat: add runtime task runner`.**

### Task 3: Connect agent/tool execution without bypassing security

**Files:**
- Modify: `apps/runtime/src/tasks/TaskRunner.ts`
- Test: `apps/runtime/test/tasks/TaskRunner.test.ts`

**Interfaces:**
- Runner execution receives an injected `ToolExecutor` and command policy.
- Tool commands must continue through `SecurityPolicy.validateCommand` via `ToolExecutor.execute`; the existing executor already enforces this boundary before `execFile`. fileciteturn208file0L2-L2

- [ ] **Step 1: Add failing tests proving allowed commands execute through the injected executor and blocked commands surface as failed tasks.**
- [ ] **Step 2: Run the focused tests and confirm failure.**
- [ ] **Step 3: Implement the injected execution adapter; never call `child_process` from the renderer or directly from the new orchestration layer.**
- [ ] **Step 4: Persist a checkpoint before execution and a final result after execution.**
- [ ] **Step 5: Run TaskRunner plus security tests and confirm pass.**
- [ ] **Step 6: Commit with `feat: route tasks through secure tool execution`.**

### Task 4: Expose task submission and events over Electron IPC

**Files:**
- Modify: `apps/runtime/src/ipc.ts` (or the existing IPC registration module identified by the repository's current IPC tests)
- Modify: `apps/desktop/src/preload.ts`
- Modify: `packages/contracts/src/tasks.ts` if event payloads need refinement
- Test: existing IPC tests plus a new task IPC test

**Interfaces:**
- Renderer API exposes `window.idle.tasks.submit(request)`, `window.idle.tasks.get(id)`, and `window.idle.tasks.subscribe(listener)`.
- Main/runtime validates the contract and delegates to `TaskRunner`.

- [ ] **Step 1: Write failing IPC tests for submit/get/status event forwarding.**
- [ ] **Step 2: Run focused IPC tests and confirm failure.**
- [ ] **Step 3: Register handlers and preload bridges using the existing Electron IPC pattern.**
- [ ] **Step 4: Ensure subscriptions are removable and do not leak listeners.**
- [ ] **Step 5: Run all runtime IPC tests and desktop typecheck.**
- [ ] **Step 6: Commit with `feat: expose task execution over ipc`.**

### Task 5: Wire Quick Task into the workspace UI

**Files:**
- Modify: `apps/desktop/src/renderer/WorkspaceShell.tsx`
- Create: `apps/desktop/src/renderer/taskUiModel.ts`
- Test: `apps/desktop/src/renderer/taskUiModel.test.ts`
- Test: `apps/desktop/src/renderer/WorkspaceShell.test.tsx` if the repository has a configured component-test environment; otherwise keep deterministic logic in the model test.

**Interfaces:**
- UI submits the current `taskPrompt` through `window.idle.tasks.submit`.
- UI consumes task status events and maps them to `planning | running | verifying | review | completed | failed` presentation states.
- No direct filesystem or shell calls are added to React.

- [ ] **Step 1: Write failing model tests for empty prompt, submission state, status mapping, completion, and failure.**
- [ ] **Step 2: Run focused renderer tests and confirm failure.**
- [ ] **Step 3: Implement `taskUiModel` as a pure state mapper.**
- [ ] **Step 4: Replace the static `agentCount: 0`/empty-agent panel with state derived from active task events while retaining the existing visual hierarchy.**
- [ ] **Step 5: Submit Quick Task on Enter/button action, clear the input only after successful submission, and show failure inline without losing the prompt.**
- [ ] **Step 6: Run all desktop tests and typecheck.**
- [ ] **Step 7: Commit with `feat: connect quick task to runtime status`.**

### Task 6: Preserve review-first ChangeSet behavior

**Files:**
- Modify: existing runtime task execution/result integration files identified during implementation
- Test: existing ChangeSet/Project/Conflict tests plus a focused task-result integration test

**Interfaces:**
- Task completion returns a reviewable result containing task id, status, summary, and ChangeSet/preview identifier when changes exist.
- Applying changes remains an explicit existing review operation; task completion must not auto-apply unreviewed changes.

- [ ] **Step 1: Write failing integration tests proving a task that proposes changes produces a reviewable preview and does not mutate the project before approval.**
- [ ] **Step 2: Run the focused integration test and confirm failure.**
- [ ] **Step 3: Connect the existing ChangeSet preview path to the task result.**
- [ ] **Step 4: Add the explicit apply/reject transition using existing services; do not duplicate file-write logic.**
- [ ] **Step 5: Run ChangeSet, conflict, workspace, and task tests.**
- [ ] **Step 6: Commit with `feat: keep agent changes reviewable before apply`.**

### Task 7: Recovery and lifecycle integration

**Files:**
- Modify: runtime startup/lifecycle module that currently initializes `TaskService`
- Test: `apps/runtime/test/recovery/runtime-recovery.test.ts` and a task lifecycle integration test

**Interfaces:**
- Startup calls `TaskService.load()` before accepting task submissions.
- Existing `resumePendingTasks` is used with the new runner/resume handler so interrupted tasks become running again only after a valid resume path succeeds; otherwise they pause with a diagnostic. fileciteturn207file0L2-L2

- [ ] **Step 1: Add failing recovery integration coverage for an interrupted running task.**
- [ ] **Step 2: Run the recovery test and confirm failure.**
- [ ] **Step 3: Register the TaskRunner resume handler during runtime initialization.**
- [ ] **Step 4: Verify failed resume transitions to paused with a useful error and successful resume emits running.**
- [ ] **Step 5: Run the full runtime recovery suite.**
- [ ] **Step 6: Commit with `feat: resume task runner state on runtime startup`.**

### Task 8: End-to-end verification and release regression gate

**Files:**
- Modify: `.github/workflows/*` only if the existing CI does not already cover the new focused tests
- Test: full repository test/typecheck suite and Windows packaging workflow

- [ ] **Step 1: Run `pnpm typecheck`.**
- [ ] **Step 2: Run `pnpm test`.**
- [ ] **Step 3: Run the repository's lint/build commands if present.**
- [ ] **Step 4: Verify the Quick Task → task event → reviewable result flow with the existing test doubles; verify no direct renderer execution path exists.**
- [ ] **Step 5: Run Windows packaging and verify the installer workflow remains green.**
- [ ] **Step 6: Review changed files for accidental API/security/review-boundary regressions.**
- [ ] **Step 7: Commit any required final CI-only fixes with an explicit reason.**

## Spec Coverage Review

- Quick Task UI is already present and intentionally stops before runtime execution: Task 5 closes this gap. fileciteturn211file0L2-L2
- Task lifecycle/persistence/recovery: Tasks 2 and 7 use the existing `TaskService`. fileciteturn207file0L2-L2
- Security/tool boundary: Task 3 preserves `SecurityPolicy` through `ToolExecutor`. fileciteturn208file0L2-L2
- Human approval boundary: Task 3 respects `AgentRequestService` decisions; it already returns `approval_required` for configured capabilities. fileciteturn209file0L2-L2
- Review-first changes: Task 6 prevents task execution from silently applying changes.
- Windows release regression: Task 8 retains the packaging gate.
