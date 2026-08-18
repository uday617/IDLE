# Multi-Agent Coding IDE — Design Specification

**Date:** 2026-08-19  
**Status:** Draft for user review  
**Target:** Windows V1

## 1. Vision

Build a standalone Windows desktop coding IDE that combines a developer-focused editor experience with a coordinated multi-agent engineering system.

The system should be able to scan and understand an existing codebase, accept a high-level engineering task, plan and delegate work to one or more agents, make only necessary code changes, verify those changes, and safely integrate the result without unnecessarily disturbing unrelated parts of the project.

The V1 mission is:

> A Windows desktop coding IDE where one or more AI agents can understand an existing project, collaboratively implement a user task, make minimal controlled changes, verify those changes, and safely integrate the result.

Nemotron is the initial LLM provider. The architecture must keep the LLM layer replaceable.

## 2. Product Scope

### In scope for V1

- Standalone Windows desktop IDE
- Project/file explorer
- Code editor
- Integrated terminal
- Git integration
- Task-first workflow
- Quick Task and Advanced Task modes
- Automatic and manually configured agents
- Central orchestrator
- Dynamic agent creation through orchestrator approval
- Persistent project intelligence
- Incremental project indexing
- Language-agnostic project intelligence architecture
- Live project graph
- Targeted context retrieval
- Agent event communication
- Agent memory
- Patch-based code modification
- Change-impact analysis
- Change budget
- File coordination/locking
- Shared workspace execution
- Git worktrees for risky/conflicting parallel work
- Verification and testing
- Rollback/checkpoints
- Diff/review workflow
- Agent action ledger
- Three-level autonomy model
- Nemotron provider
- User-supplied API key stored securely on Windows
- LLM provider abstraction
- Streaming agent activity
- Resilience to model/API failures

### Explicitly out of scope for initial V1

- Built-in hosted AI service
- Multi-user collaboration
- Cloud synchronization
- Billing/subscriptions
- Plugin marketplace
- Deployment/cloud management
- Recreating every VS Code feature
- Full deep semantic support for every programming language

The architecture should remain extensible for these capabilities later.

## 3. UX Direction

The IDE is task-first rather than chat-first.

### Quick Task

The user provides a natural-language request, such as:

> Add JWT authentication to this project.

The orchestrator analyzes the project, creates a plan, determines affected areas, delegates work, and presents progress.

### Advanced Task

Power users can configure:

- Agents/roles
- Agent capabilities
- Execution strategy
- Shared workspace vs worktree behavior
- Approval/autonomy policy

### Task Workspace

A task workspace is the primary AI workflow surface. It shows:

- Task description
- Plan and subtasks
- Active agents
- Agent status/progress
- Files being inspected/changed
- Change summary
- Verification status
- Conflicts
- Diffs
- Final report

Agent activity should be presented as structured status rather than raw model reasoning.

Example activity:

- Analyzing authentication architecture
- Found 4 affected routes
- Reserving 3 files
- Applying patch
- Running 18 tests
- Verification passed

## 4. System Architecture

The system is divided into two major layers:

### Desktop IDE

Responsible for user interaction:

- Editor
- Explorer
- Terminal
- Task workspace
- Agent controls
- Git UI
- Diff/review UI
- Settings

### Local Agent Runtime

Responsible for intelligence and execution:

- Orchestrator
- Task planner
- Agent manager
- Agent runtimes
- Permission manager
- Tool execution
- Event bus
- Project intelligence
- Modification engine
- Verification engine
- LLM gateway

The IDE communicates with the local runtime through a local IPC/API boundary.

This separation allows the agent engine and UI to evolve independently.

## 5. Orchestrator

The orchestrator owns the overall task.

Responsibilities:

1. Understand the user's task.
2. Request relevant project context.
3. Create an execution plan.
4. Identify required subtasks.
5. Assign existing agents or create new agents.
6. Coordinate dependencies between subtasks.
7. Monitor progress.
8. Handle conflicts and failures.
9. Trigger verification and review.
10. Decide when the overall task is complete.

Agents may request additional agents, but only the orchestrator can approve and create them.

Dynamic delegation must have safeguards such as:

- Maximum active agents
- Maximum delegation depth
- Task/token/API budget
- Capability restrictions
- Idle-agent termination

## 6. Agent Model

Agents are runtime instances with explicit roles, capabilities, task context, and state.

Example roles:

- Backend
- Frontend
- Testing
- Review
- Security
- Documentation
- Database

Roles are not required to be hardcoded; the architecture should allow future configurable roles.

### Agent capabilities

Capabilities are permissioned tools/actions, such as:

- READ_FILES
- SEARCH_CODE
- SEARCH_SYMBOL
- GET_PROJECT_CONTEXT
- CREATE_PATCH
- APPLY_PATCH
- RUN_TEST
- RUN_BUILD
- RUN_LINT
- GET_GIT_STATUS
- CREATE_CHECKPOINT

Additional capabilities may be introduced later.

### Agent lifecycle

An agent follows an explicit state machine:

CREATED → INITIALIZING → UNDERSTANDING → PLANNING → EXECUTING → VERIFYING → REVIEW → COMPLETED

Failure/conflict states include:

- RECOVERING
- CONFLICT_RESOLUTION
- PAUSED
- FAILED
- CANCELLED

## 7. Agent Communication

Agents do not rely on unstructured direct conversations.

A shared event bus carries structured events.

Example:

```text
FILE_CHANGED
agent: backend-agent
file: src/auth/middleware.ts
reason: JWT authentication implementation
impact: /api/users/*
```

Events can update:

- Project graph
- Task state
- Agent state
- Relevant agents
- Orchestrator

Agents subscribe to events relevant to their tasks.

## 8. Shared State and Memory

The system maintains shared state containing:

- Current task
- Subtasks
- Agent states
- File reservations
- Project facts
- Recent changes
- Agent events
- Decisions
- Verification results

Memory is divided into:

### Short-term memory
Current task conversation and immediate tool results.

### Task memory
Discoveries and relevant information collected during a task.

### Persistent project memory
Validated project-level facts and conventions that should survive sessions.

The system must distinguish observed facts from agent assumptions and must not blindly persist every model-generated statement.

## 9. Project Intelligence

Project intelligence is language-agnostic.

### Pipeline

```text
Project
  ↓
Project Scanner
  ↓
Language Detection
  ↓
Language Adapter
  ↓
Common Project Model
  ↓
Knowledge Store
  ↓
Project Graph
  ↓
Retrieval Layer
  ↓
Agents
```

### Scanner responsibilities

Identify:

- Languages/frameworks
- Package managers
- Source directories
- Configuration
- Entry points
- Tests
- APIs/routes
- Database models
- Imports/dependencies
- Git repository
- Build/test commands

### Language adapter contract

Adapters should expose capabilities conceptually equivalent to:

- detect
- parse
- extractSymbols
- extractImports
- extractExports
- extractDependencies
- extractEndpoints
- extractTests

A generic fallback should exist for unsupported languages using structural parsing and, where necessary, LLM-assisted analysis.

### Common Project Model

The common model represents concepts independent of language:

- Files
- Symbols
- Modules
- Imports
- Exports
- Dependencies
- APIs
- Tests
- Database entities
- Configuration
- Relationships

## 10. Persistent Knowledge Store and Project Graph

Project intelligence is stored locally and persists between IDE sessions.

On reopening a project:

1. Load existing knowledge.
2. Detect changed files.
3. Incrementally re-index affected areas.
4. Update the graph.
5. Make the project available to agents.

The system must avoid full-project rescans when incremental updates are sufficient.

The project graph captures relationships such as:

```text
LoginRoute
  ↓
AuthController
  ↓
AuthService
  ↓
UserModel
  ↓
Database
```

## 11. Context Retrieval

Agents must receive targeted context rather than the entire codebase.

For a task such as:

> Fix the login API.

The retrieval layer may provide:

- Relevant routes
- Controllers/services
- Middleware
- Models
- Tests
- Dependencies
- Relevant project conventions
- Recent related changes

Context should be assembled dynamically from:

- Task
- Project graph
- Relevant files/symbols
- Agent memory
- Recent events
- Tool results

## 12. Code Modification Engine

The modification system enforces minimal, controlled changes.

Pipeline:

```text
Task
 ↓
Plan
 ↓
Impact Analysis
 ↓
Relevant Files
 ↓
Patch Proposal
 ↓
Patch Validation
 ↓
Apply
 ↓
Verification
 ↓
Review
 ↓
Checkpoint
```

Agents should generate patches/diffs rather than replacing complete files whenever practical.

### Patch validation

Before applying a patch, validate:

- Target file version
- Expected source context
- Patch applicability
- Concurrent modifications
- Scope of affected lines

## 13. Change Impact Analysis

Before modifying code, the system identifies likely affected files and relationships using the project graph and retrieval layer.

Unexpected unrelated modifications should be detected.

For example, if a task is limited to authentication but an agent attempts to modify payment, admin, and unrelated UI modules, the system should flag the deviation.

## 14. Change Budget

Tasks can establish an expected change budget.

Example:

```text
Expected:
3 files
~40 lines changed

Actual:
17 files
642 lines changed
```

A major deviation can pause execution or require user approval according to the task's autonomy policy.

The exact thresholds will be defined during implementation.

## 15. Multi-Agent Code Coordination

Normal low-conflict work may use a shared workspace with file-level coordination.

If agents attempt conflicting edits, the system can:

1. Queue/serialize the work.
2. Reassign dependent work.
3. Move one or more agents into isolated Git worktrees.
4. Resolve and review changes before integration.

No agent should silently overwrite another agent's active changes.

## 16. Git and Recovery

Git is used as a safety and integration mechanism.

Significant tasks should have checkpoints.

Parallel risky work can use isolated worktrees.

Typical flow:

```text
Checkpoint
 ↓
Agent Work
 ↓
Verification
 ↓
Review
 ↓
Merge/Integration
 ↓
Final Verification
```

Failed work should be reversible.

## 17. Verification Engine

Verification is impact-aware.

Potential checks:

- Syntax/parse validation
- Type checking
- Formatting
- Linting
- Targeted tests
- Integration tests
- Build
- Dependency validation
- Final diff review

The system should avoid running unnecessarily expensive checks when the impact graph shows they are irrelevant, while still allowing broader verification when risk warrants it.

## 18. Rollback and Recovery

If verification fails:

```text
Checkpoint
 ↓
Change
 ↓
Verification failure
 ↓
Rollback or isolate
 ↓
Agent receives failure information
 ↓
Revised patch
 ↓
Verification again
```

Repeated failure should eventually pause the task and request user intervention.

## 19. Agent Action Ledger

Every meaningful agent action should be auditable.

Example:

```text
04:21:08 Backend Agent
READ src/auth/service.ts

04:21:14 Backend Agent
PATCH src/auth/service.ts
Reason: Add token validation

04:21:18 Verification
12 tests passed

04:21:23 Reviewer
Approved patch

04:21:25 Orchestrator
Checkpoint created
```

This ledger is used for debugging, transparency, and task history.

## 20. Autonomy and Permissions

Three autonomy levels are used.

### Safe — automatic

Examples:

- Read files
- Search project
- Analyze code
- Create plans
- Run ordinary tests

### Moderate — automatic + logged

Examples:

- Modify source
- Modify tests
- Install a non-critical dependency

### Dangerous — user approval

Examples:

- Delete files
- Destructive commands
- Environment changes
- Git push
- Large unexpected changes

Policies should be configurable by project, task, and agent.

## 21. LLM Gateway

Agents do not call Nemotron directly.

They communicate with an LLM gateway/provider abstraction.

Conceptual interface:

```text
LLMProvider
 ├── generate()
 ├── stream()
 ├── countTokens()
 └── capabilities()
```

V1 implements the Nemotron provider.

Future providers can be added without changing the agent runtime.

## 22. Nemotron Credentials

V1 uses user-supplied Nemotron API credentials.

Credentials must be stored using secure Windows credential storage or equivalent secure local storage.

API keys must never be:

- Stored in project source files
- Written to .env files by default
- Committed to Git
- Sent inside agent prompts
- Exposed in normal logs

A future hosted model-access option may be added without changing the provider architecture.

## 23. Tool Execution Boundary

The LLM never receives unrestricted filesystem or shell access.

Instead:

```text
Agent
 ↓
Tool Request
 ↓
Permission Manager
 ↓
Tool Executor
 ↓
Result
 ↓
Agent
```

The runtime validates every requested tool operation against the agent's capabilities and autonomy policy.

## 24. Runtime Resilience

The runtime must handle:

- API timeouts
- Rate limits
- Network failures
- Invalid model responses
- Context overflow
- Malformed tool calls
- Tool execution errors
- Agent failures

The task state should be persistent enough to pause and resume after recoverable failures.

Agent activity should stream to the IDE so the user can see meaningful progress in real time.

## 25. Local-First Data Model

Project intelligence and agent state should be local-first.

A project may have an internal metadata directory or an external per-project data location containing:

```text
knowledge/
graph/
tasks/
events/
checkpoints/
settings/
```

The exact storage location and Git-ignore strategy will be finalized during implementation.

The system must avoid accidentally committing internal IDE metadata into the user's source repository.

## 26. V1 Success Criteria

A V1 is successful when a user can:

1. Open an existing Windows project.
2. Allow the IDE to scan and understand the project.
3. Create a natural-language task.
4. Receive a proposed execution plan.
5. Run one or more agents automatically or manually.
6. Observe agent progress.
7. Allow agents to retrieve relevant project context.
8. Make minimal patch-based changes.
9. Coordinate concurrent changes safely.
10. Run relevant verification.
11. Inspect a complete diff.
12. Roll back failed work.
13. Approve/reject dangerous operations.
14. See an auditable task/action history.
15. Resume project intelligence across IDE sessions.
16. Use Nemotron through a user-provided API key.

## 27. Non-Goals and Design Principles

### Non-goals

V1 is not intended to be:

- A general-purpose autonomous computer agent
- A hosted AI coding service
- A complete VS Code replacement feature-for-feature
- A cloud collaboration platform
- A deployment platform

### Core principles

1. **Understand before changing.**
2. **Change the minimum necessary surface area.**
3. **Never silently overwrite concurrent work.**
4. **Verify before declaring success.**
5. **Make agent actions observable.**
6. **Keep project intelligence local-first.**
7. **Keep the LLM provider replaceable.**
8. **Give the user control over dangerous actions.**
9. **Prefer incremental updates over full rescans.**
10. **Treat the project state as the shared source of truth.**

## 28. Deferred Decisions

The following should be finalized in the implementation plan rather than prematurely fixed in the design:

- Exact desktop UI framework
- Exact editor component
- Exact local database technology
- Exact graph/index storage implementation
- Exact parser technologies and adapter order
- Exact IPC/API protocol
- Exact Git library/CLI integration
- Exact Nemotron API SDK/client
- Exact patch/diff implementation
- Exact test-runner detection strategy
- Exact packaging/distribution mechanism
- Exact change-budget thresholds
- Exact project metadata storage location

These are implementation choices, not unresolved product requirements.
