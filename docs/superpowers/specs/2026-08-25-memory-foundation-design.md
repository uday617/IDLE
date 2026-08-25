# Memory Foundation Design

## Goal

Give IDLE a local-first persistent memory subsystem that can retain useful project/task context across restarts and retrieve relevant memories before a new task runs.

## Scope

This milestone is the **Memory Foundation** only. Learning extraction and automated learning promotion are a follow-up milestone built on these interfaces.

### Memory layers

1. **Working memory** — task/session-scoped context; short-lived and never treated as durable project knowledge by itself.
2. **Project memory** — durable project facts, conventions, architecture notes, and decisions.
3. **Episodic memory** — durable records of task outcomes, including success/failure and verification evidence.

## Storage

Use a local SQLite database owned by the runtime. The database path must be configurable through the runtime options/environment so tests can use isolated temporary databases and desktop installations can use an application-data location.

The first implementation should use deterministic SQL filtering and ranking rather than introducing a vector database or embedding dependency. The schema must leave room for a future embedding/vector index without making it a prerequisite.

### Core records

A memory record contains:

- stable id
- project id
- layer (`working`, `project`, or `episodic`)
- kind/category
- content
- source task id when applicable
- confidence score
- created/updated timestamps
- last-accessed timestamp
- metadata JSON for structured evidence
- optional expiration timestamp for working memory

## Interfaces

The runtime memory subsystem should expose focused interfaces:

- `MemoryStore.save(record)` — persist or update a memory.
- `MemoryStore.get(id)` — retrieve one record.
- `MemoryStore.delete(id)` — remove a record.
- `MemoryStore.search(query)` — deterministic relevance search scoped by project/layer/kind and bounded by a result limit.
- `MemoryStore.listByTask(taskId)` — retrieve memories produced by a task.
- `MemoryStore.close()` — release database resources.

A higher-level `MemoryService` owns policy: normalization, confidence bounds, expiration, access timestamps, and conversion between task events and memory records. Callers should not issue SQL directly.

## Retrieval policy

Before task execution, retrieve a small bounded set of relevant durable memories using:

1. exact project scope first;
2. layer/kind filters when supplied;
3. token/term matches over content and metadata;
4. confidence and recency as tie-breakers;
5. deterministic limit.

Retrieved memories must be supplied as context to the task runner without changing the existing task contract shape for callers. The integration should be additive and preserve existing task behavior when the memory store is unavailable or empty.

## Episodic capture

The task lifecycle should create an episodic record for terminal task outcomes. The record should include:

- task prompt
- final status
- relevant ChangeSet id when available
- verification outcome when available
- concise error/failure summary when failed

Unverified agent claims must not be promoted to high-confidence project memory. Terminal task records are evidence, not automatically trusted project facts.

## Persistence and recovery

Starting the runtime must open/load the configured database and stopping the runtime must close it cleanly. Restarting with the same database path must recover previously stored project and episodic memories. Tests must use isolated temporary database paths.

Memory failures must not crash the core task pipeline. The runtime should surface/log the memory failure and continue task execution with an empty-memory context where safe.

## Testing requirements

The milestone requires:

- unit tests for schema/repository CRUD;
- search/relevance tests with deterministic ordering;
- confidence/expiration policy tests;
- task-to-episodic capture tests;
- restart persistence integration test;
- runtime integration test proving retrieved memory reaches task execution;
- regression coverage proving existing task behavior remains green with memory empty/unavailable.

## Non-goals

- no vector database;
- no embedding model dependency;
- no autonomous promotion of arbitrary agent output into trusted project facts;
- no UI for manually editing memory in this milestone;
- no Learning subsystem beyond the minimal episodic capture required to establish the memory foundation.
