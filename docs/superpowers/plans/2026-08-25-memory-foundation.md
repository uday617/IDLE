# Memory Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first persistent memory foundation that stores, retrieves, and survives restart for IDLE's task and project context without coupling memory to an LLM or vector database.

**Architecture:** Add a focused memory module under the runtime with typed records, a persistent repository, deterministic metadata/text retrieval, and task-lifecycle integration. Keep memory failures non-fatal to task execution. Learning extraction is a later milestone.

**Tech Stack:** TypeScript, existing runtime persistence mechanism, existing test runner; no new storage dependency until repository inspection proves one is needed.

**Spec:** `docs/superpowers/specs/2026-08-25-memory-foundation-design.md`

## Global Constraints

- Local-first and persistent across runtime restart.
- Deterministic retrieval; no vector database in this milestone.
- Memory must never block or corrupt normal task execution.
- Never persist secrets, raw credentials, or arbitrary tool output without filtering.
- Every production behavior must have a failing test first.

---

### Task 1: Map persistence and test conventions
- [ ] Inspect existing task persistence, dependencies, and runtime test conventions.
- [ ] Confirm the storage mechanism before adding dependencies.
- [ ] Run the existing focused runtime tests as a baseline.

### Task 2: Define memory contracts
**Files:** `apps/runtime/src/memory/MemoryTypes.ts`, `apps/runtime/test/memory/MemoryTypes.test.ts`
- [ ] Write failing contract tests.
- [ ] Verify RED.
- [ ] Implement typed working/project/episodic records with source, confidence, timestamps, and scope metadata.
- [ ] Verify GREEN.

### Task 3: Build persistent memory repository
**Files:** `apps/runtime/src/memory/MemoryRepository.ts`, `apps/runtime/test/memory/MemoryRepository.test.ts`
- [ ] Write failing tests for insert, fetch, scoped retrieval, and reopen persistence.
- [ ] Verify RED.
- [ ] Implement the smallest repository/schema using the mechanism confirmed in Task 1.
- [ ] Add only indexes justified by retrieval queries.
- [ ] Verify GREEN.

### Task 4: Add deterministic retrieval
**Files:** `apps/runtime/src/memory/MemoryRetriever.ts`, `apps/runtime/test/memory/MemoryRetriever.test.ts`
- [ ] Write failing relevance-ordering tests.
- [ ] Verify RED.
- [ ] Implement bounded deterministic retrieval using scope, kind, terms, confidence, and freshness.
- [ ] Down-rank stale/low-confidence memories.
- [ ] Verify GREEN.

### Task 5: Capture task outcomes
**Files:** `apps/runtime/src/memory/TaskMemoryRecorder.ts`, narrowest task lifecycle integration point, `apps/runtime/test/memory/TaskMemoryRecorder.test.ts`
- [ ] Write failing completed/failed outcome tests.
- [ ] Verify RED.
- [ ] Implement bounded task summaries and verification outcomes.
- [ ] Make recorder failures non-fatal to tasks.
- [ ] Verify GREEN.

### Task 6: Retrieve memory for new tasks
**Files:** narrowest runtime task/agent context integration point, `apps/runtime/test/memory/RuntimeMemoryIntegration.test.ts`
- [ ] Write failing integration test showing a relevant prior memory reaches task context.
- [ ] Verify RED.
- [ ] Add bounded retrieval before planning/execution.
- [ ] Fall back to empty context on memory failure.
- [ ] Verify GREEN.

### Task 7: Restart and project isolation
**Files:** `apps/runtime/test/memory/MemoryPersistence.integration.test.ts`, existing restart fixture only if needed
- [ ] Write failing restart-persistence and project-isolation tests.
- [ ] Verify RED.
- [ ] Wire safe startup/shutdown.
- [ ] Verify GREEN and no cross-project leakage.

### Task 8: Full verification
- [ ] Run runtime typecheck and tests.
- [ ] Run repository-wide tests/lint/typecheck.
- [ ] Run Windows E2E regression.
- [ ] Review for unnecessary dependencies, secret leakage, unbounded growth, and task-path coupling.
- [ ] Commit the focused memory foundation.

**Definition of Done:** Memory survives restart, deterministic retrieval is tested, task outcomes are captured, relevant memories reach future tasks, failures remain isolated, and existing CI/E2E remains green.
