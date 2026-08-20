# Agent Change Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the runtime-independent Change Set contract and validation/apply engine that lets agents propose minimal, reviewable file changes without directly mutating the workspace.

**Architecture:** Put the shared Change Set data model in `packages/contracts` and the pure validation/apply engine in `packages/core`. The engine receives the exact base file contents for the proposed files, validates project-relative paths and exact source context, applies line hunks in memory, and returns deterministic resulting contents; filesystem writes, IPC, agent orchestration, and UI review remain later integration layers.

**Tech Stack:** TypeScript, Vitest, existing `@idle/contracts` and `@idle/core` packages. Do not add a diff library for this checkpoint; use a small deterministic line-hunk implementation so the core remains dependency-free.

**Spec:** `2026-08-19-multi-agent-ide-design (1).md`, especially Section 12 (Code Modification Engine), Section 13 (Change Impact Analysis), Section 14 (Change Budget), and Section 15 (Multi-Agent Code Coordination).

## Global Constraints

- Agents never receive unrestricted filesystem or shell access.
- Code changes use controlled patches whenever practical, not blind whole-file rewrites.
- The product must not silently overwrite concurrent agent work.
- Every successful coding task ends with verification evidence and an inspectable diff.
- Keep the LLM provider and agent runtime independent of the change engine.
- Keep `packages/core` runtime-independent and dependency-free.
- This checkpoint does not implement filesystem writes, IPC, Monaco UI, agent orchestration, change-budget policy, locking, or Git worktrees.
- Existing Phase 1 behavior must remain unchanged.

---

## File Map

- Create: `packages/contracts/src/changes.ts` — shared Change Set/domain types.
- Modify: `packages/contracts/src/index.ts` — export change contracts.
- Create: `packages/contracts/test/changes.test.ts` — contract shape tests.
- Create: `packages/core/src/changeSet.ts` — pure validation and apply functions.
- Modify: `packages/core/src/index.ts` — export the change engine.
- Create: `packages/core/test/changeSet.test.ts` — exhaustive engine tests.

The existing `packages/contracts` package already exports domain contracts through `src/index.ts`, and `packages/core` currently exposes runtime-independent utilities through `src/index.ts`; the new code follows those boundaries. fileciteturn73file0 fileciteturn70file0

---

### Task 1: Define the Change Set contract

**Files:**
- Create: `packages/contracts/src/changes.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/changes.test.ts`

**Interfaces:**

```ts
export type ChangeOperation = 'modify' | 'create' | 'delete';

export interface TextHunk {
  oldStart: number;
  oldLines: string[];
  newLines: string[];
}

export interface ModifyChange {
  operation: 'modify';
  path: string;
  baseContent: string;
  hunks: TextHunk[];
}

export interface CreateChange {
  operation: 'create';
  path: string;
  baseContent: null;
  content: string;
}

export interface DeleteChange {
  operation: 'delete';
  path: string;
  baseContent: string;
}

export type FileChange = ModifyChange | CreateChange | DeleteChange;

export interface ChangeSet {
  id: string;
  description: string;
  changes: FileChange[];
}
```

**Why:** `baseContent` is intentionally exact rather than a weak timestamp/version. It gives the runtime a deterministic concurrency guard later. Modify operations carry line hunks so an agent does not need to replace an entire file. Create/delete are included now so later agent tasks do not invent a second change protocol.

- [ ] **Step 1: Write the failing contract tests.** Test that a modify change contains `path`, exact `baseContent`, and ordered hunks; a create change has `baseContent: null` and content; a delete change has the expected base content; and a Change Set can contain multiple operations.
- [ ] **Step 2: Run the contract test to verify it fails.** Run `pnpm --filter @idle/contracts test`. Expected: FAIL because `changes.ts` and its exports do not exist.
- [ ] **Step 3: Implement the minimal contract.** Add the discriminated unions above and export them from `packages/contracts/src/index.ts`.
- [ ] **Step 4: Run the contract test to verify it passes.** Run `pnpm --filter @idle/contracts test` and `pnpm --filter @idle/contracts typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** Use `feat: define controlled change set contract`.

---

### Task 2: Implement exact hunk validation and in-memory application

**Files:**
- Create: `packages/core/src/changeSet.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/changeSet.test.ts`

**Interfaces:**

```ts
export interface ChangeFileState {
  exists: boolean;
  content: string;
}

export interface ChangeSetValidationError {
  path: string;
  code:
    | 'INVALID_PATH'
    | 'DUPLICATE_PATH'
    | 'BASE_MISMATCH'
    | 'INVALID_HUNK'
    | 'HUNK_MISMATCH'
    | 'MISSING_CONTENT';
  message: string;
}

export interface ChangeSetValidationResult {
  valid: boolean;
  errors: ChangeSetValidationError[];
}

export interface AppliedChange {
  path: string;
  operation: 'modify' | 'create' | 'delete';
  content: string | null;
}

export interface ApplyChangeSetResult {
  changes: AppliedChange[];
}

export function validateChangeSet(
  changeSet: ChangeSet,
  files: ReadonlyMap<string, ChangeFileState>,
): ChangeSetValidationResult;

export function applyChangeSet(
  changeSet: ChangeSet,
  files: ReadonlyMap<string, ChangeFileState>,
): ApplyChangeSetResult;
```

**Validation rules:**

1. Paths must be project-relative POSIX-style paths: non-empty, no leading `/`, no drive prefix, no `.`/`..` path segments, and no backslash separators.
2. A path may occur only once in a Change Set.
3. `modify` requires an existing file whose content exactly equals `baseContent`.
4. `create` requires the target to be absent and requires string content.
5. `delete` requires an existing file whose content exactly equals `baseContent`.
6. Hunk line numbers are 1-based; `oldStart` must be at least 1; `oldLines` must match the target file exactly at the requested location.
7. Hunks must be ordered and non-overlapping.
8. Applying hunks must not mutate the supplied input map or its strings.
9. `applyChangeSet` must first validate the entire Change Set and throw/return a deterministic validation failure rather than partially applying changes.
10. The engine is pure: it never reads or writes the filesystem.

- [ ] **Step 1: Write failing tests for path validation.** Cover valid `src/auth.ts`, rejection of `/etc/passwd`, `../outside.ts`, `src/../outside.ts`, `C:/outside.ts`, and `src\\auth.ts`; cover duplicate paths.
- [ ] **Step 2: Run the focused tests.** Run `pnpm --filter @idle/core test`. Expected: FAIL because the engine functions do not exist.
- [ ] **Step 3: Write failing tests for base-content and hunk validation.** Cover a valid replacement, stale `baseContent`, wrong hunk context, out-of-range `oldStart`, overlapping hunks, and unsorted hunks.
- [ ] **Step 4: Implement validation only.** Add deterministic path checks, duplicate detection, exact base-content comparison, hunk ordering checks, and exact old-line matching. Keep the implementation dependency-free.
- [ ] **Step 5: Run the focused tests.** Run `pnpm --filter @idle/core test`. Expected: validation tests PASS while apply tests remain FAIL.
- [ ] **Step 6: Write failing tests for application.** Cover one hunk, multiple ordered hunks, insertion (`oldLines: []`), deletion (`newLines: []`), create, delete, multiple files, and rejection without partial output when any file is stale.
- [ ] **Step 7: Implement `applyChangeSet`.** Validate the whole set first, then construct new strings in memory. For modify operations, copy untouched ranges and replace each exact hunk range with `newLines`; for create return the supplied content; for delete return `null`.
- [ ] **Step 8: Run the focused tests.** Run `pnpm --filter @idle/core test` and `pnpm --filter @idle/core typecheck`. Expected: PASS.
- [ ] **Step 9: Commit.** Use `feat: add deterministic change set engine`.

---

### Task 3: Add regression coverage for minimal, concurrent-safe changes

**Files:**
- Modify: `packages/core/test/changeSet.test.ts`
- Modify: `packages/contracts/test/changes.test.ts`

**Interfaces:**
- No new public interfaces; this task hardens the contract from Tasks 1–2.

- [ ] **Step 1: Add a minimal-change regression test.** Start with a three-function file and a Change Set that replaces one function's lines. Assert the resulting content leaves both unrelated functions byte-for-byte unchanged.
- [ ] **Step 2: Add a concurrent-edit regression test.** Use the same planned `baseContent` but provide a workspace version with an unrelated line changed. Assert validation fails with `BASE_MISMATCH` and no resulting content is produced.
- [ ] **Step 3: Add multi-file atomicity coverage.** Provide two valid changes and one stale change. Assert the result reports failure and never returns a partially applied two-file result.
- [ ] **Step 4: Run the complete workspace verification.** Run `pnpm typecheck` followed by `pnpm test`. Expected: all existing Phase 1 tests plus the new Change Set tests pass.
- [ ] **Step 5: Commit.** Use `test: harden change set concurrency guarantees`.

---

## Verification Gate

Before this sub-project is considered complete:

```text
pnpm typecheck   → PASS
pnpm test        → PASS
```

The implementation is **not** allowed to claim filesystem safety yet. This plan proves only the pure Change Set contract and deterministic validation/apply behavior. The next integration plan must connect it to `FileService`, runtime IPC, permission checks, Diff UI, action ledger, change budget, and Git checkpoints.

## Explicit Next Sub-Project

After this plan is green, the next plan should integrate the pure engine into the local runtime:

```text
Agent proposal
      ↓
ChangeSet contract
      ↓
ChangeSet validator
      ↓
Project/FileService current state
      ↓
Permission + conflict checks
      ↓
Diff/review UI
      ↓
User Apply / Reject
      ↓
Atomic filesystem write
      ↓
Verification
      ↓
Checkpoint / ledger
```
