# IDLE V1 Final Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish every remaining V1 product-surface, runtime-hardening, verification, documentation, and release item so IDLE is complete from Windows UI through runtime and packaged-app validation.

**Architecture:** Preserve the existing Electron renderer/runtime IPC boundary and extend it with typed task, agent, terminal, Git, verification, approval, ledger, and settings state. Reuse the existing orchestrator, memory/learning, project intelligence, ChangeSet, recovery, and Nemotron implementations rather than replacing working runtime code. The final release gate exercises the complete user path in the packaged Windows application.

**Tech Stack:** Electron, React, TypeScript, Vite, Monaco, Node.js, Vitest, Playwright, existing workspace packages, Git CLI/runtime adapters, GitHub Actions, Windows packaging.

**Spec:** `2026-08-19-multi-agent-ide-design (1).md`

## Global Constraints

- Keep the IDE task-first, not chat-first.
- Preserve the existing local runtime and Electron IPC boundary.
- Never expose unrestricted filesystem or shell access to the model.
- Dangerous actions require explicit user approval and are logged.
- Prefer patch-based changes and existing ChangeSet/review infrastructure.
- Keep project intelligence and memory local-first and provider-independent.
- Do not commit IDE metadata, credentials, or generated secrets into user projects.
- Do not regress the existing green runtime, memory/learning, recovery, or Windows E2E paths.
- Every new user-visible capability gets renderer tests and an integration/E2E assertion where practical.
- Final completion requires green typecheck, tests, Windows E2E, packaging, and packaged-app smoke validation.

---

### Task 1: Establish the final typed product-state contract

**Files:**
- Modify: `packages/contracts/src/*` files that currently define task/agent/runtime contracts
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/main/runtimeClient.ts`
- Test: existing contracts/runtime IPC tests plus new renderer contract tests

**Interfaces:**
- Produces typed `TaskWorkspaceState`, `AgentViewState`, `VerificationViewState`, `ActionLedgerEntry`, `ApprovalRequest`, `GitViewState`, `TerminalEvent`, and `RuntimeSettings` payloads.
- Consumes existing task, ChangeSet, memory, orchestration, verification, and runtime event contracts.

- [ ] Step 1: Inventory existing IPC channels and contracts for tasks, ChangeSets, agents, events, verification, memory, Git, and project state; keep existing channel names where compatible.
- [ ] Step 2: Add failing contract tests proving the renderer can represent a task plan, multiple agents, verification checks, approvals, ledger entries, Git state, terminal output, and settings without `any` casts.
- [ ] Step 3: Implement the minimal shared types and preload exposure required by those tests.
- [ ] Step 4: Add runtime event normalization so existing agent/runtime events map deterministically into the new UI state without exposing model reasoning.
- [ ] Step 5: Run the contracts/runtime typecheck and focused tests; expected result is green with no public API regressions.
- [ ] Step 6: Commit as `feat: define final V1 desktop runtime contracts`.

### Task 2: Build the complete Task Workspace and Advanced Task UI

**Files:**
- Modify: `apps/desktop/src/renderer/WorkspaceShell.tsx`
- Create: `apps/desktop/src/renderer/TaskWorkspace.tsx`
- Create: `apps/desktop/src/renderer/TaskPlanPanel.tsx`
- Create: `apps/desktop/src/renderer/AgentActivityPanel.tsx`
- Create: `apps/desktop/src/renderer/VerificationPanel.tsx`
- Create: `apps/desktop/src/renderer/TaskReportPanel.tsx`
- Create: `apps/desktop/src/renderer/ConflictPanel.tsx`
- Create: `apps/desktop/src/renderer/ActionLedgerPanel.tsx`
- Create: `apps/desktop/src/renderer/AdvancedTaskForm.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`
- Test: corresponding `*.test.tsx`/model tests

**Interfaces:**
- Consumes `TaskWorkspaceState` and runtime events from Task 1.
- Produces a single task-first workspace containing task description, plan/subtasks, active agents, progress, files, ChangeSet summary, verification, conflicts, ledger, and final report.

- [ ] Step 1: Add failing UI model tests for Quick Task and Advanced Task modes, including agent role/capability configuration and shared-workspace/worktree strategy.
- [ ] Step 2: Add failing tests for rendering task plan, multiple agent cards, file activity, verification checks, conflict state, and final report.
- [ ] Step 3: Implement the typed UI models and state transitions without coupling components directly to runtime implementation details.
- [ ] Step 4: Implement the Task Workspace panels and wire them into `WorkspaceShell`.
- [ ] Step 5: Implement Advanced Task controls for roles, capabilities, execution strategy, autonomy policy, and delegation limits.
- [ ] Step 6: Add responsive desktop layout and explicit empty/loading/error states.
- [ ] Step 7: Run renderer tests and typecheck; expected result is green.
- [ ] Step 8: Commit as `feat: complete task workspace UI`.

### Task 3: Add terminal, Git, review, and settings surfaces

**Files:**
- Create: `apps/desktop/src/renderer/TerminalPanel.tsx`
- Create: `apps/desktop/src/renderer/GitPanel.tsx`
- Create: `apps/desktop/src/renderer/SettingsPanel.tsx`
- Create: `apps/desktop/src/renderer/ApprovalDialog.tsx`
- Create: `apps/desktop/src/renderer/DiffPanel.tsx` if existing ChangeSet review cannot provide the required complete diff surface
- Modify: `apps/desktop/src/renderer/WorkspaceShell.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: runtime IPC/main handlers as required by existing runtime services
- Test: terminal, Git, settings, approval, and diff UI tests

**Interfaces:**
- Consumes existing runtime tool, worktree, ChangeSet, and credential services.
- Produces user-facing terminal output, Git status/diff/checkpoint controls, secure Nemotron settings, and dangerous-operation approval/rejection.

- [ ] Step 1: Add failing tests for terminal command request/stream/result/error states and approval gating.
- [ ] Step 2: Add failing tests for Git status, diff, checkpoint, branch/worktree information, and ChangeSet integration.
- [ ] Step 3: Add failing tests for settings persistence and redaction; API keys must never render in logs or task events.
- [ ] Step 4: Implement the renderer surfaces using existing IPC/runtime capabilities; add only missing IPC adapters where required.
- [ ] Step 5: Ensure dangerous operations cannot execute unless an approval decision is present and that the decision is emitted to the action ledger.
- [ ] Step 6: Verify complete diff review can show changed files, hunks, verification result, and apply/reject/rollback controls.
- [ ] Step 7: Run focused renderer/runtime tests and typecheck.
- [ ] Step 8: Commit as `feat: add terminal git settings and approval UI`.

### Task 4: Finish orchestration hardening and runtime policy controls

**Files:**
- Modify: existing `MultiAgentCoordinator` implementation
- Modify: existing delegation/task configuration contracts
- Modify: existing agent lifecycle/event code
- Modify: permission manager/tool executor files
- Test: coordinator, delegation, cancellation, budget, permission, and recovery tests

**Interfaces:**
- Consumes existing coordinator, agent runtime, permission, event bus, memory, and recovery services.
- Produces bounded orchestration with maximum active agents, delegation depth, token/API/task budget enforcement, capability checks, and idle-agent termination.

- [ ] Step 1: Add failing tests for depth `0..N`, active-agent cap, task budget, token/API budget, and deterministic rejection of over-budget delegation.
- [ ] Step 2: Add failing tests proving idle agents are cancelled and their task state is recoverable without corrupting shared state.
- [ ] Step 3: Add failing tests proving every tool request is checked against capabilities and autonomy policy before execution.
- [ ] Step 4: Implement the policy limits using explicit configuration with safe defaults and persistence through task state.
- [ ] Step 5: Emit structured ledger/events for policy rejection, cancellation, and recovery.
- [ ] Step 6: Run focused runtime tests plus existing memory/recovery/orchestration suites.
- [ ] Step 7: Commit as `feat: harden delegation budgets and agent lifecycle`.

### Task 5: Complete language fallback and project-intelligence release coverage

**Files:**
- Modify: existing project scanner/indexer/language-adapter contracts
- Create: generic structural language adapter in the existing project-intelligence package
- Modify: context retrieval/project graph only where required
- Test: scanner/indexer/retrieval/fallback adapter tests

**Interfaces:**
- Consumes the existing common project model and language adapter contract.
- Produces structural parsing fallback for unsupported languages with deterministic file/import/symbol/test evidence where possible.

- [ ] Step 1: Add failing tests for an unsupported-language fixture proving scanner detection and structural file relationships are retained.
- [ ] Step 2: Implement the generic fallback adapter without weakening the existing TypeScript adapter.
- [ ] Step 3: Add incremental re-index tests proving unchanged files are not fully rescanned.
- [ ] Step 4: Add retrieval tests proving task context can combine project graph facts, project memory, recent events, and relevant files.
- [ ] Step 5: Run project-intelligence and memory/learning tests.
- [ ] Step 6: Commit as `feat: add generic project intelligence fallback`.

### Task 6: Finish streaming activity, ledger, verification, and final-report plumbing

**Files:**
- Modify: runtime event bus/agent lifecycle/verification integration files
- Modify: desktop runtime client and renderer state models
- Modify: `TaskWorkspace` panels from Task 2
- Test: runtime-to-renderer integration tests

**Interfaces:**
- Consumes structured runtime events, verification results, ChangeSets, memory/learning outcomes, and recovery events.
- Produces ordered task timeline, agent activity, verification evidence, final report, and resumable task history.

- [ ] Step 1: Add failing integration tests for an event sequence `plan → agent start → file read → patch → verification → review → checkpoint → complete`.
- [ ] Step 2: Add failing tests for failure/recovery sequences and ensure stale `running` events cannot overwrite terminal task state.
- [ ] Step 3: Implement event aggregation with monotonic ordering and deduplication.
- [ ] Step 4: Persist enough task state to resume after recoverable model/API/tool failures.
- [ ] Step 5: Generate the final report from structured evidence, not model prose, including files changed, checks run, result, recovery actions, and remaining warnings.
- [ ] Step 6: Verify the ledger and final report are visible in the Task Workspace.
- [ ] Step 7: Run integration tests and typecheck.
- [ ] Step 8: Commit as `feat: wire live activity verification and task history`.

### Task 7: Add the full Windows product-loop E2E suite

**Files:**
- Modify: existing Windows E2E workflow and tests
- Create/modify: Windows Playwright product-loop fixtures and helper utilities
- Modify: Nemotron E2E fixture only where required
- Test: packaged and development Windows application paths

**Interfaces:**
- Consumes the complete UI/runtime surface from Tasks 1–6.
- Produces repeatable evidence for the complete V1 success criteria.

- [ ] Step 1: Add an E2E fixture project containing source files, tests, Git state, and a deliberate multi-agent change opportunity.
- [ ] Step 2: Add a test that opens the project, scans it, creates Quick Task, displays plan/context, and starts execution.
- [ ] Step 3: Add assertions for multiple agents, streaming activity, file reservations/changes, ChangeSet, verification, ledger, and final report.
- [ ] Step 4: Add an Advanced Task flow configuring roles, capabilities, autonomy, and delegation limits.
- [ ] Step 5: Add dangerous-operation approval/rejection coverage and verify rejection prevents execution.
- [ ] Step 6: Add conflict/recovery/rollback coverage and verify the task can resume.
- [ ] Step 7: Add terminal/Git/settings coverage without leaking the Nemotron credential.
- [ ] Step 8: Run the full Windows E2E locally/through Actions; expected result is green.
- [ ] Step 9: Commit as `test: cover complete V1 Windows product flow`.

### Task 8: Release hardening, docs reconciliation, and final quality gate

**Files:**
- Modify: `README.md`
- Modify: root design/implementation references only where links are stale
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/windows-e2e.yml`
- Modify: `.github/workflows/nemotron-e2e.yml`
- Modify: `.github/workflows/windows-package.yml`
- Create: final release checklist under `docs/superpowers/`
- Test: repository-wide test/typecheck/build/package commands

**Interfaces:**
- Consumes all implementation work and CI workflows.
- Produces a reproducible release gate and truthful documentation.

- [ ] Step 1: Search the repository for stale `docs/superpowers/specs`/`plans` paths, placeholder TODO/TBD markers, hardcoded secrets, and obsolete branch references.
- [ ] Step 2: Update README to point to the actual current design/plan locations and describe the real V1 workflow.
- [ ] Step 3: Ensure CI validates the final branch/main push path and does not silently skip the new product E2E suite.
- [ ] Step 4: Add a release smoke script/checklist that verifies build, package, launch, open-project, task, verification, and clean exit.
- [ ] Step 5: Run repository-wide typecheck, unit/integration tests, lint, build, Windows E2E, Nemotron E2E where credentials are available, and Windows package.
- [ ] Step 6: Inspect the final packaged artifact and verify the renderer contains all required V1 surfaces.
- [ ] Step 7: Create a final audit report listing every V1 success criterion and its test/evidence location.
- [ ] Step 8: Commit as `chore: close V1 release gate`.

### Task 9: Final branch audit and main integration

**Files:**
- No functional files unless the final audit discovers a verified defect.
- Test: all release gates from Task 8.

- [ ] Step 1: Compare `feat/v1-final-completion` against `main` and inspect every changed file for unintended scope.
- [ ] Step 2: Re-run all required checks after the final commit, not merely earlier task checks.
- [ ] Step 3: Confirm no open PR/branch dependency or stale implementation branch is required by the finished V1.
- [ ] Step 4: Open the final PR targeting `main` with the complete audit summary and evidence.
- [ ] Step 5: Wait for all required GitHub checks to turn green; if any check fails, diagnose and fix the root cause before merge.
- [ ] Step 6: Merge the final PR only after all required checks are green.
- [ ] Step 7: Verify `main` post-merge with the combined status and latest Windows/package/E2E runs.
- [ ] Step 8: Mark V1 complete only if every success criterion has direct implementation and verification evidence.
