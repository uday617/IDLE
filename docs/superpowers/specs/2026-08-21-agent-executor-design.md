# Agent Executor Design

## Goal
Add a real, deterministic agent-execution boundary behind the existing TaskRunner without bypassing the project's reviewable ChangeSet flow.

## Scope
The first slice implements project inspection and deterministic planning only. It does not directly mutate project files, invoke an external LLM provider, or auto-apply changes.

## Architecture
`Quick Task -> TaskRunner -> AgentExecutor -> ProjectInspector -> Plan -> TaskResult`

`AgentExecutor` owns orchestration for one task. `ProjectInspector` is read-only and gathers bounded project context. The executor produces a structured plan/result that can later feed the existing ChangeSet generation/apply path.

## Safety boundaries
- Inspection is read-only.
- No shell command execution is introduced by this slice.
- No arbitrary file writes are introduced by this slice.
- Executor failures are returned through the existing TaskRunner failure lifecycle.
- The executor receives an explicit project root and task prompt rather than reaching into global process state.

## Interfaces
`ProjectInspector.inspect(root)` returns a bounded snapshot containing project metadata and selected source-file summaries.

`AgentExecutor.execute(request)` accepts the task id, project root, prompt, and optional checkpoint, invokes inspection, creates a deterministic plan, and returns the plan result.

The existing TaskRunner executor callback remains the integration point; TaskRunner continues to own status persistence and events.

## Planning result
The first result contains:
- task id
- prompt
- inspected project root
- discovered file paths relevant to the task
- ordered plan steps
- a statement that no files were modified

## Error handling
Invalid/missing project roots fail the task with a clear error. Inspection errors are propagated to TaskRunner, which persists `failed` and emits the failure event.

## Testing
- Unit tests for ProjectInspector with a temporary fixture.
- Unit tests for AgentExecutor proving deterministic planning and read-only behavior.
- Runtime integration coverage proving TaskRunner invokes AgentExecutor and preserves lifecycle events.
- Full `pnpm typecheck` and `pnpm test`.
- Existing Windows packaging remains required before merge.

## Out of scope
Real model-provider integration, code generation, ChangeSet creation/application, autonomous shell execution, and automatic approval are separate follow-up slices.