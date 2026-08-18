# Multi-Agent Coding IDE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-first standalone coding IDE whose local agent runtime can understand an existing project, execute controlled coding tasks with one or more agents, make minimal patch-based changes, verify them, and safely integrate the result.

**Architecture:** Use an Electron + React + TypeScript desktop shell for the IDE, with a separate local TypeScript/Node agent runtime communicating through a typed local IPC/API boundary. Keep project intelligence, agent orchestration, code modification, verification, and the Nemotron integration as independently testable runtime modules.

**Tech Stack:** Windows 11 target; Electron; React; TypeScript; Monaco Editor; Node.js; SQLite for persistent local metadata; Tree-sitter adapters for structural parsing; Git CLI for Git/worktree operations; Vitest for unit/integration tests; Playwright for desktop/UI smoke coverage; Nemotron through an HTTP provider adapter. Exact dependency versions should be pinned during repository initialization.

**Spec:** `docs/superpowers/specs/2026-08-19-multi-agent-ide-design.md`

## Global Constraints

- Windows is the only supported desktop platform for V1.
- The IDE and Local Agent Runtime remain separate architectural processes/modules.
- Nemotron is the initial LLM provider, behind a replaceable provider interface.
- User API credentials are stored using secure Windows credential storage and never in project source files or Git.
- Agents never receive unrestricted filesystem or shell access.
- Code changes use controlled patches whenever practical, not blind whole-file rewrites.
- Project intelligence is local-first and persists between sessions.
- Project indexing is incremental after the initial scan.
- Agents coordinate through shared state/events rather than unrestricted direct communication.
- Shared-workspace execution is the default for low-conflict work; risky/conflicting work can use Git worktrees.
- Safe operations are automatic, moderate operations are automatic and logged, and dangerous operations require user approval.
- V1 must prioritize a reliable single-agent loop before multi-agent parallel execution.
- The product must not silently overwrite concurrent agent work.
- Every successful coding task ends with verification evidence and an inspectable diff.

---

## Plan Decomposition

The approved design spans several independent subsystems. To keep implementation reviewable, execute this master plan as the following sequential sub-project plans:

1. **Foundation + Basic IDE**
2. **Project Intelligence**
3. **Single-Agent Runtime + Nemotron**
4. **Safe Modification + Verification**
5. **Multi-Agent Orchestration**
6. **Parallel Worktrees + Integration**
7. **Advanced Delegation + Memory**
8. **Production Hardening**

Each sub-project should leave the application in a working, testable state before the next one begins. The tasks below define the dependency order and the concrete deliverables that later sub-project plans should implement.

---

# Phase 0 — Foundation

### Task 1: Initialize the monorepo and development contract

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `apps/desktop/package.json`
- Create: `apps/runtime/package.json`
- Create: `packages/contracts/package.json`
- Create: `packages/core/package.json`
- Create: `tests/smoke/repository.test.ts`

**Interfaces:**
- Produces a workspace containing `desktop`, `runtime`, `contracts`, and `core` packages.
- `packages/contracts` is the shared source of typed IPC/domain contracts.
- `packages/core` contains runtime-independent domain types and utilities.

- [ ] Define the workspace scripts for build, test, lint, typecheck, and package.
- [ ] Pin Node.js and package-manager versions in repository configuration.
- [ ] Add TypeScript strict mode and path conventions.
- [ ] Add the repository smoke test that imports each package entry point.
- [ ] Run the smoke test and typecheck.
- [ ] Commit with `chore: initialize multi-agent ide workspace`.

### Task 2: Define shared domain contracts

**Files:**
- Create: `packages/contracts/src/project.ts`
- Create: `packages/contracts/src/task.ts`
- Create: `packages/contracts/src/agent.ts`
- Create: `packages/contracts/src/events.ts`
- Create: `packages/contracts/src/tools.ts`
- Create: `packages/contracts/src/permissions.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/contracts.test.ts`

**Interfaces:**
- `ProjectId`, `TaskId`, `AgentId` are opaque string identifiers.
- `TaskStatus` includes `queued | planning | running | verifying | completed | failed | cancelled | paused`.
- `AgentStatus` includes `created | initializing | understanding | planning | executing | verifying | review | completed | recovering | conflict_resolution | paused | failed | cancelled`.
- `AgentEvent` contains `id`, `timestamp`, `taskId`, optional `agentId`, `type`, and structured `payload`.
- `ToolRequest` contains `requestId`, `agentId`, `toolName`, and typed arguments.
- `PermissionLevel` is `safe | moderate | dangerous`.

- [ ] Write tests that serialize/deserialize representative task, agent, event, tool, and permission objects.
- [ ] Implement the contracts with runtime validation at the IPC boundary.
- [ ] Run contract tests and typecheck.
- [ ] Commit with `feat: define shared runtime contracts`.

### Task 3: Build the Electron desktop shell

**Files:**
- Create: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/preload.ts`
- Create: `apps/desktop/src/renderer/App.tsx`
- Create: `apps/desktop/src/renderer/app.css`
- Create: `apps/desktop/src/renderer/components/WorkspaceShell.tsx`
- Create: `apps/desktop/test/shell.test.ts`

**Interfaces:**
- Preload exposes a minimal typed `window.agentRuntime` bridge.
- `WorkspaceShell` renders the future Explorer, Editor, Task, Agent, Terminal, and Git surfaces without embedding runtime logic.

- [ ] Write a renderer smoke test for the root workspace.
- [ ] Implement the Electron main/preload/renderer boundary.
- [ ] Add the initial application layout.
- [ ] Run renderer tests and launch the Windows development build.
- [ ] Commit with `feat: add desktop shell`.

### Task 4: Establish the local runtime process and IPC boundary

**Files:**
- Create: `apps/runtime/src/main.ts`
- Create: `apps/runtime/src/ipc/server.ts`
- Create: `apps/runtime/src/ipc/router.ts`
- Create: `apps/runtime/test/ipc.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- `RuntimeServer.start(): Promise<void>`
- `RuntimeServer.stop(): Promise<void>`
- `RuntimeRouter.handle(request): Promise<Response>`
- Health operation returns `{ status: "ok", version: string }`.

- [ ] Write the failing IPC health-check test.
- [ ] Implement the local runtime server and typed router.
- [ ] Connect Electron preload to the runtime health operation.
- [ ] Run the IPC test and desktop smoke test.
- [ ] Commit with `feat: add local agent runtime boundary`.

---

# Phase 1 — Basic IDE

### Task 5: Add project opening and workspace state

**Files:**
- Create: `apps/runtime/src/project/ProjectService.ts`
- Create: `apps/runtime/test/project/ProjectService.test.ts`
- Create: `apps/desktop/src/renderer/state/workspaceStore.ts`
- Create: `apps/desktop/test/workspace.test.ts`

**Interfaces:**
- `ProjectService.open(path): Promise<Project>`
- `ProjectService.close(projectId): Promise<void>`
- `ProjectService.get(projectId): Promise<Project>`

- [ ] Test opening a temporary project and rejecting a non-directory path.
- [ ] Implement project registration and normalized path handling.
- [ ] Expose open/close/get through IPC.
- [ ] Add desktop workspace state.
- [ ] Run tests.
- [ ] Commit with `feat: support opening local projects`.

### Task 6: Add file explorer and Monaco editor

**Files:**
- Create: `apps/runtime/src/project/FileService.ts`
- Create: `apps/runtime/test/project/FileService.test.ts`
- Create: `apps/desktop/src/renderer/components/FileExplorer.tsx`
- Create: `apps/desktop/src/renderer/components/CodeEditor.tsx`
- Create: `apps/desktop/test/editor.test.ts`

**Interfaces:**
- `FileService.list(projectId, path): Promise<FileEntry[]>`
- `FileService.read(projectId, path): Promise<string>`
- `FileService.write(projectId, path, content, expectedVersion): Promise<FileWriteResult>`

- [ ] Test safe project-relative path resolution.
- [ ] Test stale-version rejection for writes.
- [ ] Implement file operations with project-root containment checks.
- [ ] Integrate Monaco with read/write operations.
- [ ] Run unit and renderer tests.
- [ ] Commit with `feat: add project explorer and editor`.

### Task 7: Add terminal and basic Git surfaces

**Files:**
- Create: `apps/runtime/src/tools/TerminalService.ts`
- Create: `apps/runtime/src/git/GitService.ts`
- Create: `apps/runtime/test/tools/TerminalService.test.ts`
- Create: `apps/runtime/test/git/GitService.test.ts`
- Create: `apps/desktop/src/renderer/components/TerminalPanel.tsx`
- Create: `apps/desktop/src/renderer/components/GitPanel.tsx`

**Interfaces:**
- `TerminalService.run(command, cwd, policy): Promise<TerminalResult>`
- `GitService.status(projectId): Promise<GitStatus>`
- `GitService.diff(projectId): Promise<GitDiff>`

- [ ] Test terminal execution through a harmless command.
- [ ] Test Git status/diff against a temporary repository.
- [ ] Implement process execution with cancellation hooks.
- [ ] Implement Git CLI wrappers without shell string interpolation.
- [ ] Render terminal output and Git status.
- [ ] Run tests.
- [ ] Commit with `feat: add terminal and git basics`.

---

# Phase 2 — Project Intelligence

### Task 8: Implement persistent SQLite project metadata

**Files:**
- Create: `apps/runtime/src/storage/Database.ts`
- Create: `apps/runtime/src/storage/migrations/001_initial.sql`
- Create: `apps/runtime/src/storage/ProjectRepository.ts`
- Create: `apps/runtime/test/storage/ProjectRepository.test.ts`

**Interfaces:**
- `ProjectRepository.upsertProject(project): Promise<void>`
- `ProjectRepository.getProject(projectId): Promise<ProjectRecord | null>`
- `ProjectRepository.saveFileMetadata(record): Promise<void>`
- `ProjectRepository.listChangedFiles(projectId): Promise<FileMetadata[]>`

- [ ] Test project/file metadata persistence across database reopen.
- [ ] Implement schema migration and repository methods.
- [ ] Store project metadata outside source-controlled project files by default.
- [ ] Run storage tests.
- [ ] Commit with `feat: add persistent project metadata`.

### Task 9: Implement scanner and incremental change detection

**Files:**
- Create: `apps/runtime/src/intelligence/scanner/ProjectScanner.ts`
- Create: `apps/runtime/src/intelligence/scanner/FileClassifier.ts`
- Create: `apps/runtime/src/intelligence/scanner/ChangeDetector.ts`
- Create: `apps/runtime/test/intelligence/scanner.test.ts`

**Interfaces:**
- `ProjectScanner.scan(root): Promise<ScanResult>`
- `FileClassifier.classify(path): FileClassification`
- `ChangeDetector.detect(projectId): Promise<ChangeSet>`

- [ ] Test ignored directories and binary/non-source classification.
- [ ] Test first scan versus subsequent changed-file scan.
- [ ] Implement scanner with configurable ignore rules.
- [ ] Persist file hashes/metadata.
- [ ] Implement incremental change detection.
- [ ] Run scanner tests on fixture projects.
- [ ] Commit with `feat: add incremental project scanner`.

### Task 10: Define language adapter interface and generic parsing

**Files:**
- Create: `apps/runtime/src/intelligence/parsers/LanguageAdapter.ts`
- Create: `apps/runtime/src/intelligence/parsers/AdapterRegistry.ts`
- Create: `apps/runtime/src/intelligence/parsers/GenericAdapter.ts`
- Create: `apps/runtime/test/intelligence/parsers.test.ts`

**Interfaces:**
- `LanguageAdapter.detect(file): number`
- `LanguageAdapter.parse(file): ParsedFile`
- `LanguageAdapter.extractSymbols(parsed): SymbolRecord[]`
- `LanguageAdapter.extractImports(parsed): ImportRecord[]`
- `LanguageAdapter.extractExports(parsed): ExportRecord[]`
- `LanguageAdapter.extractDependencies(parsed): DependencyRecord[]`

- [ ] Test adapter registration and language detection.
- [ ] Implement generic structural fallback.
- [ ] Add Tree-sitter adapter plumbing without making any single language mandatory for the core model.
- [ ] Run parser tests against representative fixture files.
- [ ] Commit with `feat: add language adapter framework`.

### Task 11: Build the common project model and graph

**Files:**
- Create: `apps/runtime/src/intelligence/model/ProjectModel.ts`
- Create: `apps/runtime/src/intelligence/graph/ProjectGraph.ts`
- Create: `apps/runtime/src/intelligence/graph/GraphRepository.ts`
- Create: `apps/runtime/test/intelligence/graph.test.ts`

**Interfaces:**
- `ProjectGraph.upsertNode(node): Promise<void>`
- `ProjectGraph.upsertEdge(edge): Promise<void>`
- `ProjectGraph.findRelated(nodeId, relationTypes, depth): Promise<GraphNode[]>`
- `ProjectGraph.removeFile(fileId): Promise<void>`

- [ ] Test symbol/import/dependency graph construction.
- [ ] Test removal and incremental replacement of a changed file.
- [ ] Implement graph persistence and relation traversal.
- [ ] Connect parser output to graph updates.
- [ ] Run graph tests.
- [ ] Commit with `feat: add persistent project graph`.

### Task 12: Implement targeted context retrieval

**Files:**
- Create: `apps/runtime/src/intelligence/retrieval/ContextRetriever.ts`
- Create: `apps/runtime/src/intelligence/retrieval/RelevanceScorer.ts`
- Create: `apps/runtime/test/intelligence/retrieval.test.ts`

**Interfaces:**
- `ContextRetriever.retrieve(projectId, taskDescription, options): Promise<ProjectContext>`
- `RelevanceScorer.score(candidate, query): number`

- [ ] Create a fixture project with related and unrelated modules.
- [ ] Test that task-specific retrieval prioritizes relevant files/symbols/dependencies.
- [ ] Implement graph-based expansion and relevance scoring.
- [ ] Add context size/token-budget limits.
- [ ] Run retrieval tests.
- [ ] Commit with `feat: add targeted project context retrieval`.

---

# Phase 3 — Single-Agent Runtime + Nemotron

### Task 13: Implement secure credential storage and Nemotron provider

**Files:**
- Create: `apps/runtime/src/credentials/CredentialStore.ts`
- Create: `apps/runtime/src/llm/LLMProvider.ts`
- Create: `apps/runtime/src/llm/NemotronProvider.ts`
- Create: `apps/runtime/src/llm/LLMGateway.ts`
- Create: `apps/runtime/test/llm/NemotronProvider.test.ts`

**Interfaces:**
- `CredentialStore.set(service, key, value): Promise<void>`
- `CredentialStore.get(service, key): Promise<string | null>`
- `CredentialStore.delete(service, key): Promise<void>`
- `LLMProvider.generate(request): Promise<LLMResponse>`
- `LLMProvider.stream(request): AsyncIterable<LLMEvent>`
- `LLMProvider.countTokens(input): Promise<number>`
- `LLMGateway.complete(request): Promise<LLMResponse>`

- [ ] Test provider request construction with a mocked HTTP server.
- [ ] Test timeout, rate-limit, malformed-response, and retry behavior.
- [ ] Implement secure credential storage using a Windows credential-store integration.
- [ ] Implement the provider adapter using the current Nemotron API contract.
- [ ] Ensure API keys are redacted from logs and never included in project context.
- [ ] Run LLM tests.
- [ ] Commit with `feat: add Nemotron LLM gateway`.

### Task 14: Implement permission-aware tool execution

**Files:**
- Create: `apps/runtime/src/agents/tools/ToolRegistry.ts`
- Create: `apps/runtime/src/agents/tools/ToolExecutor.ts`
- Create: `apps/runtime/src/agents/permissions/PermissionManager.ts`
- Create: `apps/runtime/test/agents/tools.test.ts`

**Interfaces:**
- `ToolRegistry.register(definition): void`
- `ToolRegistry.get(name): ToolDefinition`
- `PermissionManager.evaluate(action): PermissionDecision`
- `ToolExecutor.execute(request): Promise<ToolResult>`

- [ ] Test allowed safe operations.
- [ ] Test moderate actions being logged.
- [ ] Test dangerous actions being blocked pending approval.
- [ ] Implement project-root filesystem containment.
- [ ] Implement command execution through validated argument arrays rather than interpolated shell strings.
- [ ] Run tool and permission tests.
- [ ] Commit with `feat: add permission-aware agent tools`.

### Task 15: Implement agent state machine and single-agent loop

**Files:**
- Create: `apps/runtime/src/agents/AgentRuntime.ts`
- Create: `apps/runtime/src/agents/AgentStateMachine.ts`
- Create: `apps/runtime/src/agents/AgentContext.ts`
- Create: `apps/runtime/src/agents/AgentManager.ts`
- Create: `apps/runtime/test/agents/AgentRuntime.test.ts`

**Interfaces:**
- `AgentManager.create(spec): Promise<Agent>`
- `AgentManager.stop(agentId): Promise<void>`
- `AgentRuntime.run(task): Promise<AgentResult>`
- `AgentRuntime.pause(): Promise<void>`
- `AgentRuntime.resume(): Promise<void>`

- [ ] Test legal and illegal state transitions.
- [ ] Test an agent retrieving project context and requesting a read tool.
- [ ] Implement the model/tool execution loop.
- [ ] Persist task and agent state after each meaningful transition.
- [ ] Implement cancellation and pause/resume.
- [ ] Run agent tests with mocked LLM/tool providers.
- [ ] Commit with `feat: add single-agent runtime`.

### Task 16: Build the first end-to-end coding task

**Files:**
- Create: `apps/runtime/src/tasks/TaskService.ts`
- Create: `apps/runtime/test/tasks/end-to-end.test.ts`
- Modify: `apps/desktop/src/renderer/components/WorkspaceShell.tsx`

**Interfaces:**
- `TaskService.create(input): Promise<Task>`
- `TaskService.start(taskId): Promise<void>`
- `TaskService.get(taskId): Promise<Task>`

- [ ] Create a fixture repository with a small bug.
- [ ] Write an end-to-end test that creates a task, retrieves context, proposes a change, and verifies the result using mocked Nemotron.
- [ ] Implement task creation/start/get.
- [ ] Connect the task workspace to runtime state.
- [ ] Run the end-to-end fixture test.
- [ ] Commit with `feat: complete first coding-task loop`.

---

# Phase 4 — Safe Modification + Verification

### Task 17: Implement patch generation and validation

**Files:**
- Create: `apps/runtime/src/modification/PatchEngine.ts`
- Create: `apps/runtime/src/modification/PatchValidator.ts`
- Create: `apps/runtime/test/modification/PatchEngine.test.ts`

**Interfaces:**
- `PatchEngine.create(input): Patch`
- `PatchValidator.validate(patch, workspace): ValidationResult`
- `PatchEngine.apply(patch, workspace): Promise<AppliedPatch>`

- [ ] Test a minimal insertion, replacement, deletion, and stale-context rejection.
- [ ] Implement patch parsing and context matching.
- [ ] Reject patches whose source context no longer matches.
- [ ] Record changed ranges and files.
- [ ] Run patch tests.
- [ ] Commit with `feat: add controlled patch engine`.

### Task 18: Implement impact analysis and change budget

**Files:**
- Create: `apps/runtime/src/modification/ImpactAnalyzer.ts`
- Create: `apps/runtime/src/modification/ChangeBudget.ts`
- Create: `apps/runtime/test/modification/impact.test.ts`

**Interfaces:**
- `ImpactAnalyzer.analyze(projectId, task): Promise<ImpactReport>`
- `ChangeBudget.create(report): ChangeBudget`
- `ChangeBudget.evaluate(actual): BudgetDecision`

- [ ] Test graph-based affected-file discovery.
- [ ] Test a normal change against an expected budget.
- [ ] Test a major scope deviation causing a pause/approval decision.
- [ ] Implement impact traversal using the project graph.
- [ ] Implement file/line/change-count metrics.
- [ ] Run tests.
- [ ] Commit with `feat: add change impact and budget controls`.

### Task 19: Implement checkpoints and rollback

**Files:**
- Create: `apps/runtime/src/recovery/CheckpointService.ts`
- Create: `apps/runtime/src/recovery/RollbackService.ts`
- Create: `apps/runtime/test/recovery/rollback.test.ts`

**Interfaces:**
- `CheckpointService.create(projectId, taskId): Promise<Checkpoint>`
- `RollbackService.restore(checkpointId): Promise<void>`

- [ ] Test checkpoint creation in a temporary Git repository.
- [ ] Test restoration after a failed patch.
- [ ] Implement Git-backed checkpoints.
- [ ] Ensure uncommitted user changes are detected before destructive recovery.
- [ ] Run rollback tests.
- [ ] Commit with `feat: add task checkpoints and rollback`.

### Task 20: Implement verification orchestration

**Files:**
- Create: `apps/runtime/src/verification/VerificationPlanner.ts`
- Create: `apps/runtime/src/verification/VerificationRunner.ts`
- Create: `apps/runtime/src/verification/VerificationReport.ts`
- Create: `apps/runtime/test/verification/verification.test.ts`

**Interfaces:**
- `VerificationPlanner.plan(impact): VerificationPlan`
- `VerificationRunner.run(plan): Promise<VerificationReport>`

- [ ] Test selection for syntax, typecheck, lint, unit, integration, and build checks using project metadata.
- [ ] Implement verification command discovery.
- [ ] Implement bounded command execution and cancellation.
- [ ] Aggregate results into a structured report.
- [ ] Run verification tests against fixture repositories.
- [ ] Commit with `feat: add impact-aware verification`.

### Task 21: Add diff review, audit ledger, and autonomy UI

**Files:**
- Create: `apps/runtime/src/audit/ActionLedger.ts`
- Create: `apps/desktop/src/renderer/components/DiffReview.tsx`
- Create: `apps/desktop/src/renderer/components/ApprovalDialog.tsx`
- Create: `apps/desktop/src/renderer/components/TaskReport.tsx`
- Create: `apps/desktop/test/task-review.test.ts`

**Interfaces:**
- `ActionLedger.append(entry): Promise<void>`
- `ActionLedger.list(taskId): Promise<ActionEntry[]>`
- `ApprovalDialog` resolves `approve | reject`.

- [ ] Test audit entries are created for tool calls, patches, verification, and approvals.
- [ ] Render final changed-file summary and verification evidence.
- [ ] Render dangerous-action approval dialogs.
- [ ] Add diff inspection to the task workspace.
- [ ] Run renderer tests.
- [ ] Commit with `feat: add task review and audit UI`.

---

# Phase 5 — Multi-Agent Orchestration

### Task 22: Implement agent roles and task decomposition

**Files:**
- Create: `apps/runtime/src/orchestration/TaskPlanner.ts`
- Create: `apps/runtime/src/orchestration/RoleRegistry.ts`
- Create: `apps/runtime/test/orchestration/planner.test.ts`

**Interfaces:**
- `TaskPlanner.createPlan(task): Promise<TaskPlan>`
- `RoleRegistry.register(role): void`
- `RoleRegistry.select(requirements): AgentRole[]`

- [ ] Test decomposition into independent backend/frontend/test subtasks using a mocked planner response.
- [ ] Implement plan validation and dependency representation.
- [ ] Implement built-in role definitions without coupling roles to a single model.
- [ ] Run planner tests.
- [ ] Commit with `feat: add task planning and agent roles`.

### Task 23: Implement event bus and shared agent state

**Files:**
- Create: `apps/runtime/src/events/EventBus.ts`
- Create: `apps/runtime/src/orchestration/SharedTaskState.ts`
- Create: `apps/runtime/test/events/EventBus.test.ts`
- Create: `apps/runtime/test/orchestration/SharedTaskState.test.ts`

**Interfaces:**
- `EventBus.publish(event): Promise<void>`
- `EventBus.subscribe(filter, handler): Unsubscribe`
- `SharedTaskState.get(taskId): Promise<TaskState>`
- `SharedTaskState.update(taskId, patch): Promise<TaskState>`

- [ ] Test event ordering and subscriber filtering.
- [ ] Test concurrent task-state updates.
- [ ] Persist important events.
- [ ] Connect file-change and verification events to shared state.
- [ ] Run tests.
- [ ] Commit with `feat: add shared agent event state`.

### Task 24: Implement orchestrator

**Files:**
- Create: `apps/runtime/src/orchestration/Orchestrator.ts`
- Create: `apps/runtime/test/orchestration/Orchestrator.test.ts`

**Interfaces:**
- `Orchestrator.startTask(taskId): Promise<void>`
- `Orchestrator.assignSubtask(taskId, subtaskId, agentSpec): Promise<AgentId>`
- `Orchestrator.handleEvent(event): Promise<void>`
- `Orchestrator.completeTask(taskId): Promise<void>`

- [ ] Test assignment of independent subtasks to multiple agents.
- [ ] Test dependency blocking and release.
- [ ] Test agent failure causing recovery/reassignment.
- [ ] Implement orchestration over the existing AgentManager and EventBus.
- [ ] Run orchestration tests.
- [ ] Commit with `feat: add multi-agent orchestrator`.

### Task 25: Add manual agent controls and task-first multi-agent UI

**Files:**
- Create: `apps/desktop/src/renderer/components/TaskWorkspace.tsx`
- Create: `apps/desktop/src/renderer/components/AgentList.tsx`
- Create: `apps/desktop/src/renderer/components/CreateAgentDialog.tsx`
- Create: `apps/desktop/test/task-workspace.test.tsx`

**Interfaces:**
- Task workspace displays plan, subtasks, agents, progress, changes, verification, and approvals.
- Manual agent creation submits an `AgentSpec` to the runtime.

- [ ] Test rendering agent states and task progress.
- [ ] Add Quick Task and Advanced Task entry points.
- [ ] Add manual role/capability selection.
- [ ] Stream structured agent events into the UI.
- [ ] Run renderer tests.
- [ ] Commit with `feat: add task-first multi-agent workspace`.

---

# Phase 6 — Parallel Worktrees + Integration

### Task 26: Implement file coordination and conflict detection

**Files:**
- Create: `apps/runtime/src/workspace/FileCoordinator.ts`
- Create: `apps/runtime/test/workspace/FileCoordinator.test.ts`

**Interfaces:**
- `FileCoordinator.reserve(agentId, paths): Promise<Reservation>`
- `FileCoordinator.release(reservationId): Promise<void>`
- `FileCoordinator.conflicts(paths): Promise<Conflict[]>`

- [ ] Test non-overlapping reservations.
- [ ] Test overlapping reservations.
- [ ] Test reservation release after agent failure.
- [ ] Implement persistent in-memory/runtime coordination with task recovery.
- [ ] Run tests.
- [ ] Commit with `feat: add multi-agent file coordination`.

### Task 27: Implement Git worktree manager

**Files:**
- Create: `apps/runtime/src/git/WorktreeManager.ts`
- Create: `apps/runtime/test/git/WorktreeManager.test.ts`

**Interfaces:**
- `WorktreeManager.create(projectId, taskId, agentId): Promise<Worktree>`
- `WorktreeManager.remove(worktreeId): Promise<void>`
- `WorktreeManager.merge(worktreeId, target): Promise<MergeResult>`

- [ ] Test worktree creation and cleanup in temporary repositories.
- [ ] Test a clean merge.
- [ ] Test a merge conflict and preserve conflict details.
- [ ] Implement Git CLI operations using argument arrays.
- [ ] Run worktree tests.
- [ ] Commit with `feat: add isolated git worktrees`.

### Task 28: Add automatic conflict escalation and integration verification

**Files:**
- Create: `apps/runtime/src/workspace/ConflictManager.ts`
- Create: `apps/runtime/src/orchestration/IntegrationManager.ts`
- Create: `apps/runtime/test/workspace/ConflictManager.test.ts`
- Create: `apps/runtime/test/orchestration/IntegrationManager.test.ts`

**Interfaces:**
- `ConflictManager.resolve(policy): Promise<ConflictResolution>`
- `IntegrationManager.integrate(taskId): Promise<IntegrationResult>`

- [ ] Test low-risk conflicts being serialized.
- [ ] Test high-risk conflicts being isolated to worktrees.
- [ ] Test post-merge verification.
- [ ] Implement escalation rules based on overlapping files and change impact.
- [ ] Integrate successful worktrees only after verification.
- [ ] Run integration tests.
- [ ] Commit with `feat: add parallel work integration`.

---

# Phase 7 — Advanced Agent Delegation + Memory

### Task 29: Implement controlled dynamic agent creation

**Files:**
- Create: `apps/runtime/src/orchestration/AgentRequestService.ts`
- Create: `apps/runtime/test/orchestration/AgentRequestService.test.ts`

**Interfaces:**
- `AgentRequestService.request(parentAgentId, request): Promise<AgentRequestDecision>`

- [ ] Test approval when an agent requests a necessary specialist.
- [ ] Test rejection when active-agent or delegation-depth limits are exceeded.
- [ ] Implement orchestrator-only agent creation.
- [ ] Add task/token/API budgets.
- [ ] Add idle-agent termination.
- [ ] Run tests.
- [ ] Commit with `feat: add controlled dynamic agent delegation`.

### Task 30: Implement layered agent memory

**Files:**
- Create: `apps/runtime/src/memory/ShortTermMemory.ts`
- Create: `apps/runtime/src/memory/TaskMemory.ts`
- Create: `apps/runtime/src/memory/ProjectMemory.ts`
- Create: `apps/runtime/src/memory/MemoryRepository.ts`
- Create: `apps/runtime/test/memory/memory.test.ts`

**Interfaces:**
- `ShortTermMemory.append(entry): void`
- `TaskMemory.save(taskId, entry): Promise<void>`
- `ProjectMemory.saveFact(projectId, fact): Promise<void>`
- `ProjectMemory.listFacts(projectId): Promise<ProjectFact[]>`

- [ ] Test short-term context expiration.
- [ ] Test task memory isolation.
- [ ] Test persistent project facts surviving process restart.
- [ ] Implement confidence/source metadata so assumptions are not stored as validated facts.
- [ ] Connect approved project facts to retrieval.
- [ ] Run memory tests.
- [ ] Commit with `feat: add layered agent memory`.

---

# Phase 8 — Production Hardening

### Task 31: Add runtime recovery and persistent task resume

**Files:**
- Create: `apps/runtime/src/recovery/RuntimeRecoveryService.ts`
- Create: `apps/runtime/test/recovery/runtime-recovery.test.ts`
- Modify: `apps/runtime/src/tasks/TaskService.ts`

**Interfaces:**
- `RuntimeRecoveryService.resumePendingTasks(): Promise<TaskId[]>`

- [ ] Test restart during a running task.
- [ ] Persist enough state to resume from the last safe checkpoint.
- [ ] Mark unrecoverable tasks as paused rather than falsely completing them.
- [ ] Run recovery tests.
- [ ] Commit with `feat: add task recovery`.

### Task 32: Harden security and tool execution

**Files:**
- Create: `apps/runtime/src/security/SecurityPolicy.ts`
- Create: `apps/runtime/test/security/security-policy.test.ts`
- Modify: `apps/runtime/src/agents/tools/ToolExecutor.ts`
- Modify: `apps/runtime/src/credentials/CredentialStore.ts`

**Interfaces:**
- `SecurityPolicy.validatePath(projectRoot, candidate): void`
- `SecurityPolicy.validateCommand(policy, command): void`

- [ ] Test path traversal rejection.
- [ ] Test blocked destructive commands.
- [ ] Test credential redaction.
- [ ] Test that agent requests cannot escape the project/tool policy boundary.
- [ ] Run security tests.
- [ ] Commit with `fix: harden runtime security boundaries`.

### Task 33: Add performance and large-project safeguards

**Files:**
- Create: `apps/runtime/src/intelligence/indexing/IndexScheduler.ts`
- Create: `apps/runtime/test/intelligence/indexing/IndexScheduler.test.ts`
- Modify: `apps/runtime/src/intelligence/retrieval/ContextRetriever.ts`

**Interfaces:**
- `IndexScheduler.schedule(changes): Promise<void>`
- `IndexScheduler.flush(projectId): Promise<void>`

- [ ] Test batching of rapid file changes.
- [ ] Test cancellation of obsolete indexing jobs.
- [ ] Implement incremental/batched indexing.
- [ ] Add context-size limits and retrieval truncation policies.
- [ ] Measure scanner/retrieval behavior on a representative large fixture project.
- [ ] Run performance tests.
- [ ] Commit with `perf: harden indexing and retrieval`.

### Task 34: Add end-to-end Windows application coverage

**Files:**
- Create: `tests/e2e/open-project.spec.ts`
- Create: `tests/e2e/single-agent-task.spec.ts`
- Create: `tests/e2e/multi-agent-task.spec.ts`
- Create: `tests/e2e/recovery.spec.ts`
- Create: `tests/fixtures/sample-project/`

**Interfaces:**
- End-to-end tests exercise the user-visible flow through the packaged/development Windows application and a local runtime.

- [ ] Create a fixture project with source, tests, Git, and an intentionally fixable bug.
- [ ] Test opening the project and indexing it.
- [ ] Test a single-agent coding task with a mocked LLM.
- [ ] Test a multi-agent task with deterministic mock agents.
- [ ] Test a failed verification followed by rollback.
- [ ] Run Playwright/Electron end-to-end coverage on Windows.
- [ ] Commit with `test: add end-to-end IDE coverage`.

### Task 35: Package the Windows V1

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `scripts/package-windows.ts`
- Create: `docs/development/windows-release.md`
- Modify: root `package.json`

**Interfaces:**
- `pnpm package:windows` produces a Windows installer artifact.

- [ ] Test the packaging command on a clean Windows environment.
- [ ] Bundle the desktop application and runtime.
- [ ] Verify runtime startup, credential access, project opening, and basic task execution from the packaged application.
- [ ] Document installation and local development.
- [ ] Commit with `build: package windows v1`.

---

# Final Verification Gate

Before declaring V1 complete, execute the complete approved scenario:

1. Install the Windows build.
2. Open a real existing project.
3. Scan and persist project intelligence.
4. Close and reopen the IDE.
5. Confirm incremental indexing.
6. Create a Quick Task.
7. Inspect the generated plan.
8. Start one agent.
9. Verify targeted context retrieval.
10. Verify minimal patch creation.
11. Verify change-budget monitoring.
12. Run targeted verification.
13. Inspect the diff.
14. Test rollback after an intentional verification failure.
15. Run a multi-agent task.
16. Confirm event-based shared state.
17. Confirm overlapping-file coordination.
18. Escalate a conflicting task to a worktree.
19. Merge and re-verify.
20. Trigger a dangerous action and confirm user approval.
21. Restart the runtime during a task and verify recovery.
22. Confirm no API key appears in logs, prompts, project files, or Git.
23. Confirm the final task report and action ledger are complete.

## Definition of Done

The V1 is done only when the final verification gate passes on Windows and the system can safely demonstrate the complete loop:

**Understand → Plan → Delegate → Retrieve → Patch → Coordinate → Verify → Review → Recover/Integrate → Report**

No feature from the deferred list should be added merely because implementation is convenient; any expansion requires an explicit scope decision.
