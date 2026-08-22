# Real Repair Verification Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing bounded repair loop to the runtime's real verification boundary so an approved repair is verified through the same project/ChangeSet machinery and failures automatically become bounded Nemotron repair proposals.

**Architecture:** Preserve the existing review-first ChangeSet boundary and `RepairCoordinator` state machine. Add a small runtime verification adapter that converts the result of the existing ChangeSet verification into `FailureContext`, then let `applyRepair` feed that failure back through `RepairCoordinator`; successful verification completes the task immediately. Keep the current injected verifier seam for deterministic tests, but make the production server able to use the real verification service without granting the repair agent direct filesystem or shell access.

**Tech Stack:** TypeScript; existing `@idle/contracts`; `ChangeSetService`; `TaskService`; `RepairCoordinator`; `RepairAgent`; Vitest; existing Windows/CI workflows; Nemotron/Ollama E2E.

**Spec:** `docs/superpowers/specs/2026-08-22-agent-self-fix-loop-design.md`

## Global Constraints

- Maximum repair attempts are exactly 3 per task.
- Every repair proposal requires the existing user review gate before apply.
- Agents never receive unrestricted filesystem or shell access.
- Verification remains the source of truth for completion.
- Failure logs passed to the agent are bounded excerpts; full evidence remains inspectable through existing verification results.
- The retry counter must survive process restart when task state is persisted.
- A failed repair-analysis/proposal does not recursively consume an unbounded retry loop.
- The existing ChangeSet apply/rollback boundary remains centralized in `ChangeSetService`.
- The production repair path must not silently fall back to a fake verifier.

---

### Task 1: Define the runtime verification adapter contract

**Files:**
- Create: `apps/runtime/src/verification/RuntimeVerifier.ts`
- Test: `apps/runtime/test/verification/RuntimeVerifier.test.ts`
- Inspect/Reuse: `apps/runtime/src/project/ChangeSetService.ts`

**Interfaces:**
- `RuntimeVerifier.verify(taskId: string, projectId: string, changeSet: ChangeSet): Promise<VerificationOutcome>`
- `VerificationOutcome = { ok: true; verifiedFiles: string[] } | { ok: false; failure: FailureContext }`

- [ ] Write a failing test proving a successful verification returns `ok: true` with the verified file list.
- [ ] Write a failing test proving a verification mismatch becomes `ok: false` with the task id, ChangeSet id, affected paths, and bounded diagnostic text.
- [ ] Implement the adapter around the existing verification/apply semantics; do not duplicate file mutation logic.
- [ ] Keep the adapter pure with respect to repair orchestration: it reports verification and never proposes or applies a repair itself.
- [ ] Run `pnpm test --filter @idle/runtime -- RuntimeVerifier` (or the repository's equivalent focused Vitest command) and `pnpm typecheck`.
- [ ] Commit `feat(runtime): add real verification adapter`.

### Task 2: Preserve structured verification evidence for repair context

**Files:**
- Modify: `apps/runtime/src/project/ChangeSetService.ts`
- Modify: `apps/runtime/src/verification/RuntimeVerifier.ts`
- Test: existing ChangeSet verification test file identified by the repository test suite
- Test: `apps/runtime/test/verification/RuntimeVerifier.test.ts`

**Interfaces:**
- Existing `ChangeSetService.apply()` continues returning successful verification data or throwing `ChangeSetVerificationError` with `errors`, `rolledBack`, and `rollbackError`.
- `RuntimeVerifier` converts a caught `ChangeSetVerificationError` into `FailureContext` without exposing arbitrary unbounded logs.

- [ ] Add a focused regression test for a verification mismatch after apply and assert rollback status remains observable.
- [ ] Add a focused regression test for rollback failure and assert the repair context contains the rollback failure message without exceeding the excerpt bound.
- [ ] Build `FailureContext` through `FailureContextBuilder` using the verification error paths as `affectedPaths` and the ChangeSet id as `changeSetId`.
- [ ] Preserve the current rollback behavior; do not move rollback into the repair coordinator.
- [ ] Run the focused verification tests and `pnpm typecheck`.
- [ ] Commit `feat(runtime): preserve verification evidence for repair`.

### Task 3: Connect the real verifier to the runtime server

**Files:**
- Modify: `apps/runtime/src/ipc/server.ts`
- Create/Modify: the smallest runtime verification integration file required by Task 1
- Test: `apps/runtime/test/ipc/server.repair.test.ts` or the existing server repair test file

**Interfaces:**
- `RuntimeServerOptions.repairVerifier` remains available as a deterministic test seam.
- Production construction uses the real `RuntimeVerifier` when no explicit test verifier is supplied.
- `RuntimeServer.applyRepair(taskId, changeSetId)` applies the approved ChangeSet, invokes the real verifier, checkpoints the verification result, and routes a failure back through `RepairCoordinator.onVerificationFailureAndPropose`.

- [ ] Write a failing server test proving an approved repair with successful real verification reaches `completed` and calls no additional repair proposal.
- [ ] Write a failing server test proving a failed verification produces a new repair decision and persists `repair.changeset` when the budget remains.
- [ ] Implement dependency wiring so production uses the real verifier while tests may inject deterministic verification outcomes.
- [ ] Ensure the server does not mark a repair successful until verification reports success.
- [ ] Ensure verification failure never directly invokes ChangeSet apply for the next proposal.
- [ ] Run focused server repair tests and `pnpm typecheck`.
- [ ] Commit `feat(runtime): connect real verifier to repair loop`.

### Task 4: Harden retry persistence and restart behavior

**Files:**
- Modify: `apps/runtime/src/tasks/TaskService.ts`
- Modify: `apps/runtime/src/agents/RepairCoordinator.ts`
- Modify: `apps/runtime/src/agents/RepairLoop.ts`
- Test: existing TaskService repair persistence tests
- Test: existing RepairCoordinator/RepairLoop tests

**Interfaces:**
- Persisted `repairAttempts` remains authoritative across process restart.
- `RepairCoordinator` reconstructs state from persisted task repair status instead of resetting the attempt budget when its in-memory map is empty.
- Attempt 4 is rejected deterministically with no agent invocation and no ChangeSet apply.

- [ ] Write a failing restart test that records two repair attempts, reconstructs the coordinator, and verifies the third attempt is allowed.
- [ ] Write a failing restart test that records three attempts, reconstructs the coordinator, and verifies no fourth proposal is generated.
- [ ] Implement only the minimum state hydration needed to make persisted task state authoritative.
- [ ] Ensure a proposal-generation failure does not increment the retry counter recursively beyond the current verification attempt.
- [ ] Run focused repair persistence tests and `pnpm typecheck`.
- [ ] Commit `fix(runtime): restore repair budget across restart`.

### Task 5: Add deterministic full lifecycle coverage

**Files:**
- Create/Modify: `apps/runtime/test/agents/RepairLoop.integration.test.ts`
- Modify: smallest existing server/ChangeSet test seam required by the test

**Interfaces:**
- Test harness covers `apply -> verify fail -> FailureContext -> repair proposal -> review -> apply -> verify pass`.
- A three-failure scenario ends in `failed` with exactly three repair attempts and no fourth proposal.

- [ ] Write the failing end-to-end deterministic scenario with one failed verification followed by a successful repair.
- [ ] Assert the generated repair ChangeSet is distinct from the failed ChangeSet.
- [ ] Assert the repair ChangeSet remains review-gated and is not auto-applied.
- [ ] Assert verification success terminates the loop immediately.
- [ ] Add the three-attempt exhaustion scenario and assert the agent is invoked exactly three times.
- [ ] Run the integration test, the full runtime test suite, and `pnpm typecheck`.
- [ ] Commit `test(runtime): cover real repair verification lifecycle`.

### Task 6: Validate the real Nemotron repair path

**Files:**
- Modify only E2E fixtures/workflow files if required by the failing real-model test
- Inspect: existing Nemotron Real E2E workflow and tests

**Interfaces:**
- Real Nemotron repair proposal generation receives bounded `FailureContext`.
- The E2E scenario preserves the review/apply boundary and never lets the model write directly to disk.

- [ ] Run the existing Nemotron real-agent E2E workflow against the current main/repair integration.
- [ ] Add one controlled fixture that produces a deterministic verification failure which the local model can repair through the existing proposal tools.
- [ ] Assert the first repair proposal is reviewable and the final verification succeeds after approval/application.
- [ ] If model nondeterminism causes the test to be flaky, keep the deterministic lifecycle test authoritative and constrain the real-model test to proposal-shape/boundary assertions rather than exact generated text.
- [ ] Run the Windows Package and Nemotron Real E2E workflows.
- [ ] Commit `test(runtime): verify real Nemotron repair path`.

### Task 7: Final verification and PR

**Files:**
- No new production files unless required by failing tests.
- Optional: runtime workflow documentation if the public repair lifecycle changed.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run the repository build/package checks used by CI.
- [ ] Review the final diff for direct mutation paths, automatic repair application, unbounded retries, and accidental bypasses of ChangeSet review.
- [ ] Push the implementation branch and open a PR into `main`.
- [ ] Wait for all required CI checks to become green before merging.
