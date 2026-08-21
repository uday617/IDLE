# Agent Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, deterministic, read-only AgentExecutor boundary to the existing TaskRunner without allowing automatic file mutation or shell execution.

**Architecture:** TaskRunner delegates task execution to an AgentExecutor. AgentExecutor validates the task request, inspects the selected project through existing ProjectService/FileService boundaries, and returns a deterministic execution result suitable for future ChangeSet generation. The first slice does not call an external model, execute shell commands, or modify project files.

**Tech Stack:** TypeScript, Node.js, Vitest, existing runtime ProjectService/FileService/TaskRunner.

**Spec:** `docs/superpowers/specs/2026-08-21-agent-executor-design.md`

## Global Constraints

- Do not execute shell commands from AgentExecutor.
- Do not mutate project files from AgentExecutor.
- Reuse existing project/file services instead of bypassing their boundaries.
- Preserve the existing `queued -> running -> completed/failed` TaskRunner lifecycle.
- Keep the executor deterministic and independently unit-testable.

---

### Task 1: Define executor contract and failing tests

**Files:**
- Create: `apps/runtime/src/agents/AgentExecutor.ts`
- Test: `apps/runtime/test/agent/AgentExecutor.test.ts`

**Interfaces:**
- Consumes: `TaskRunRequest`, project id, prompt, and a read-only project inspector.
- Produces: `AgentExecutionResult` containing task id, project id, prompt, and an inspection summary.

- [ ] **Step 1: Write tests for successful inspection and invalid project input.**
- [ ] **Step 2: Run the focused test and verify it fails because the executor does not exist.**
- [ ] **Step 3: Implement the minimal typed executor contract and deterministic inspection behavior.**
- [ ] **Step 4: Run the focused test and verify it passes.**
- [ ] **Step 5: Commit with `feat: add safe agent executor boundary`.**

### Task 2: Wire executor into runtime

**Files:**
- Modify: `apps/runtime/src/ipc/server.ts`
- Modify: `apps/runtime/src/tasks/TaskRunner.ts` only if the executor signature needs the task context
- Test: `apps/runtime/test/ipc.test.ts`

**Interfaces:**
- Consumes: `AgentExecutor.execute()` from TaskRunner's existing executor callback.
- Produces: task completion only after the executor finishes successfully; failure status when execution rejects.

- [ ] **Step 1: Add a failing IPC test proving task submission invokes project inspection through the executor.**
- [ ] **Step 2: Run the focused IPC test and verify the new assertion fails.**
- [ ] **Step 3: Construct `AgentExecutor` with existing project/file services and delegate from `TaskRunner`.**
- [ ] **Step 4: Run the focused IPC and agent tests and verify they pass.**
- [ ] **Step 5: Commit with `feat: wire agent executor into runtime tasks`.**

### Task 3: Full verification and CI

**Files:**
- No source changes unless verification exposes a real defect.

- [ ] **Step 1: Run `pnpm typecheck`.**
- [ ] **Step 2: Run `pnpm test`.**
- [ ] **Step 3: Run the Windows packaging workflow through the existing CI pipeline.**
- [ ] **Step 4: Open a PR only after all required checks are green.**
- [ ] **Step 5: Merge only after the PR checks are green; verify `main` afterward.**
