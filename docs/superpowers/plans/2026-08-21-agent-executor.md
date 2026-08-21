# Agent Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, deterministic, read-only AgentExecutor boundary to the existing TaskRunner without allowing automatic file mutation or shell execution.

**Architecture:** TaskRunner delegates task execution to an AgentExecutor. AgentExecutor validates the task request, inspects the selected project through existing ProjectService/FileService boundaries, and persists a deterministic inspection checkpoint. The first slice does not call an external model, execute shell commands, or modify project files.

**Tech Stack:** TypeScript, Node.js, Vitest, existing runtime ProjectService/FileService/TaskRunner.

**Spec:** `docs/superpowers/specs/2026-08-21-agent-executor-design.md`

## Global Constraints

- Do not execute shell commands from AgentExecutor.
- Do not mutate project files from AgentExecutor.
- Reuse existing project/file services instead of bypassing their boundaries.
- Preserve the existing `queued -> running -> completed/failed` TaskRunner lifecycle.
- Keep the executor deterministic and independently unit-testable.

---

### Task 1: Define executor contract and tests

**Files:**
- Create: `apps/runtime/src/agents/AgentExecutor.ts`
- Test: `apps/runtime/test/agent/AgentExecutor.test.ts`

- [x] Define the executor result and read-only inspection behavior.
- [x] Add focused tests for successful inspection and invalid project input.
- [x] Verify deterministic top-level entry ordering and package metadata extraction.

### Task 2: Wire executor into runtime

**Files:**
- Modify: `apps/runtime/src/tasks/TaskRunner.ts`
- Modify: `apps/runtime/src/ipc/server.ts`
- Test: `apps/runtime/test/ipc.test.ts`

- [x] Pass project context and prompt through TaskRunner to the executor.
- [x] Construct AgentExecutor from the existing ProjectService and FileService.
- [x] Persist an `agent.inspection` checkpoint after successful inspection.
- [x] Exercise task submission through IPC using a real temporary project.
- [x] Preserve queued/running/completed status events.

### Task 3: Verification and CI

- [x] Add implementation and focused tests.
- [ ] Run `pnpm typecheck` in CI.
- [ ] Run `pnpm test` in CI.
- [ ] Run Windows packaging in CI.
- [ ] Merge only after all required checks are green.
