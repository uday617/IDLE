# Durable Learning Design

## Goal
Turn verified task outcomes into bounded, durable project lessons that can be retrieved by future tasks.

## Design
The existing `ProjectLearningService` remains the persistence boundary. A new deterministic `TaskLearningExtractor` converts task outcomes into candidate lessons; only outcomes with successful verification can become durable lessons. Lessons are stored as structured `ProjectFact` values so existing persistence and project isolation are reused.

## Learning record
Each persisted lesson contains:
- `kind`: `convention`, `solution`, `failure`, or `decision`
- `statement`: bounded reusable guidance
- `evidenceTaskId`: originating task
- `evidence`: bounded verification/summary context

Repository metadata remains authoritative for confidence, source, validation, and timestamps.

## Safety
- Failed or unverified outcomes never create durable learning.
- Learning text is bounded and sanitized; secrets/credentials are not copied.
- Learning extraction is deterministic in this milestone; no LLM or vector database is introduced.
- Learning failures are non-fatal to task execution.
- Existing project-scoped retrieval remains the retrieval mechanism.
- Duplicate statements update existing evidence instead of creating unbounded duplicates.

## Success criteria
1. A verified task outcome can produce a durable structured lesson.
2. An unverified/failed outcome produces no lesson.
3. Lessons survive repository restart and remain project-isolated.
4. Relevant lessons are returned by future project-memory queries.
5. Confidence reflects verification evidence and never exceeds 1.
6. Existing CI and Windows E2E remain green.