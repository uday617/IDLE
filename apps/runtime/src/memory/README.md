# Layered Agent Memory

Memory is intentionally split by lifetime and scope:

- `ShortTermMemory` keeps ephemeral context in process memory and expires entries by TTL.
- `TaskMemory` isolates task-specific entries by `taskId`.
- `ProjectMemory` persists only validated project facts and exposes lightweight retrieval.
- `MemoryRepository` stores the local memory state outside the project source tree.

Project facts require confidence metadata, a source, and explicit validation. Unvalidated agent assumptions are rejected so they cannot become durable project truth.
