# Layered Agent Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the existing layered memory implementation into current `main`, preserving persistent task/project memory while keeping short-term memory bounded by TTL.

**Architecture:** Keep memory as a runtime-local subsystem under `apps/runtime/src/memory`. `ShortTermMemory` remains ephemeral and TTL-bound; `TaskMemory` persists task-scoped entries; `ProjectMemory` persists only validated project facts through an atomic JSON repository. Integration is intentionally incremental: first validate the existing branch against current `main`, then merge it without coupling memory to unrelated runtime behavior.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Vitest, pnpm workspace.

**Spec:** `2026-08-19-multi-agent-ide-design (1).md`

## Global Constraints

- Memory must remain local to the runtime and must not execute tools or mutate project files.
- Project facts require `validated: true` and confidence in the inclusive range `0..1` before persistence.
- Short-term entries expire automatically when their configured TTL elapses.
- Task memory is isolated by task ID.
- Project memory is isolated by project ID and supports bounded retrieval.
- Existing runtime, security, ChangeSet, recovery, and orchestration boundaries remain unchanged.
- CI, Windows Package, and Nemotron Real E2E must remain green before the memory slice is considered complete.

---

### Task 1: Bring the existing memory slice to current main

**Files:**
- Existing: `apps/runtime/src/memory/MemoryRepository.ts`
- Existing: `apps/runtime/src/memory/ShortTermMemory.ts`
- Existing: `apps/runtime/src/memory/TaskMemory.ts`
- Existing: `apps/runtime/src/memory/ProjectMemory.ts`
- Existing: `apps/runtime/test/memory/memory.test.ts`

**Interfaces:**
- Consumes the existing `feat/layered-agent-memory` implementation.
- Produces a branch/PR whose base is current `main` and whose only functional changes are the memory subsystem plus its tests/docs.

- [ ] **Step 1: Compare `feat/layered-agent-memory` with current `main`**

Run the GitHub compare for `main...feat/layered-agent-memory` and confirm the memory files are the intended delta.

Expected: only the memory subsystem, tests, and memory README are ahead of `main`.

- [ ] **Step 2: Rebase/integrate the branch against current main**

Use the existing branch as the source of the memory implementation and resolve only changes caused by the five commits that landed on `main` after the branch point. Do not overwrite newer orchestration/delegation changes.

- [ ] **Step 3: Run focused memory tests**

Run:

```bash
pnpm --filter @idle/runtime test -- apps/runtime/test/memory/memory.test.ts
```

Expected: all ShortTermMemory, TaskMemory, and ProjectMemory tests pass.

- [ ] **Step 4: Run runtime typecheck**

Run:

```bash
pnpm --filter @idle/runtime typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Run the full repository validation required by the existing workflow**

Run the repository's normal CI-equivalent checks and verify the Windows Package and Nemotron Real E2E workflows are green for the resulting PR.

Expected: no regression in existing runtime, packaging, or real-agent E2E behavior.

- [ ] **Step 6: Merge the memory PR only after validation is green**

Merge the memory PR into `main` using the repository's normal merge method.

Expected: `main` contains the layered memory subsystem and its regression coverage.

### Task 2: Verify completion status and move to Learning

**Files:**
- No functional files; verification only.

**Interfaces:**
- Consumes the merged memory slice.
- Produces an updated completion audit showing Memory complete and Learning as the next remaining area.

- [ ] **Step 1: Compare current `main` against the completion checklist**

Verify that Advanced Delegation and Memory are represented by merged code and passing validation.

- [ ] **Step 2: Inspect existing Learning branches before implementing anything new**

Check `feat/project-learning`, `feat/project-learning-integration`, and related learning branches/PRs to avoid reimplementing work that already exists.

- [ ] **Step 3: Record the next smallest validated Learning slice**

Use the same branch/PR/CI-first workflow for Learning, preserving the rule that implementation begins only after confirming what already exists.
