# Multi-Agent Orchestration V1 Design

## Goal
Add a safe, bounded multi-agent coordinator above the existing single-agent runtime so one user task can be decomposed into up to two concurrent agents by default, while preserving the existing ChangeSet review, apply, verification, rollback, and repair pipeline.

## Scope
V1 focuses on orchestration, shared coordination state/events, ownership/conflict detection, and aggregation of independent ChangeSets. Git worktrees, arbitrary agent-to-agent messaging, and large-scale parallelism are explicitly out of scope for this milestone.

## Constraints
- Default maximum concurrent agents: 2.
- Maximum is configurable, with a hard upper bound of 4 in V1.
- Existing single-agent execution remains the fallback and must not regress.
- Agents do not receive unrestricted filesystem or shell access; they continue using the existing controlled tool registry and secure executor.
- Each agent produces an inspectable ChangeSet.
- Conflicting file ownership or overlapping edits must be detected before aggregation; conflicts are surfaced rather than silently overwritten.
- The existing review/apply/verify/repair pipeline remains the final integration boundary.
- Coordination happens through structured state/events, not unrestricted direct agent messaging.

## Architecture

```text
User Task
   |
   v
MultiAgentCoordinator
   +-- TaskDecomposer
   +-- Agent 1 --+
   +-- Agent 2 --+--> CoordinationState/EventStream
                  |
                  v
            ChangeSetAggregator
                  |
          conflict detection
                  |
                  v
       existing review/apply/verify/repair
```

### Coordinator
`MultiAgentCoordinator` owns lifecycle, concurrency limits, cancellation, and final aggregation. It delegates actual coding work to the existing provider-independent agent runtime.

### Decomposer
`TaskDecomposer` converts a task into independent `AgentSubtask` records. V1 supports deterministic decomposition supplied by the runtime first; the decomposition interface remains replaceable so a model-backed planner can be added later without changing the coordinator.

### Coordination state
`CoordinationStateStore` tracks subtask ownership, status, claimed paths, ChangeSet IDs, and conflicts. Events are emitted for creation, start, progress, conflict, completion, failure, and aggregation.

### Conflict detection
`ConflictDetector` rejects aggregation when two completed subtasks claim the same path or when their ChangeSets contain overlapping file targets. V1 uses path-level conflict detection rather than attempting line-level semantic merging.

### Aggregation
`ChangeSetAggregator` accepts only compatible ChangeSets and creates a deterministic combined ChangeSet. The combined ChangeSet continues through the existing review boundary. No automatic bypass of approval is introduced.

## Data flow
1. Coordinator receives a normal task.
2. Decomposer returns zero to N subtasks, capped by configured concurrency.
3. Coordinator schedules subtasks through the existing agent execution boundary.
4. Each subtask records its claimed paths and resulting ChangeSet.
5. Conflict detector evaluates completed results.
6. If conflicts exist, coordinator emits a conflict event and leaves the task in a reviewable failed/conflict state.
7. If compatible, aggregator produces one combined ChangeSet.
8. Existing ChangeSet review/apply/verify/repair flow handles the combined result.
9. Coordinator emits the final task result and evidence.

## Failure handling
- One subtask failure does not silently disappear; it is recorded in coordination state.
- If any required subtask fails, aggregation does not proceed automatically.
- Cancellation propagates to running subtasks and records cancellation events.
- Conflicts are explicit and inspectable.
- Existing bounded repair loop remains responsible for verification failures after approved aggregation; the coordinator does not create an independent repair system.

## Testing strategy
- Unit tests for decomposition, concurrency limits, state transitions, path ownership, conflict detection, and deterministic aggregation.
- Integration tests for two agents completing independently and producing one combined ChangeSet.
- Integration test proving conflicting path claims stop aggregation.
- Regression tests proving the existing single-agent path remains unchanged.
- Final CI must run typecheck and the full runtime test suite.
- Existing Nemotron real-agent smoke test remains a required regression check.
