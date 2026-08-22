# Agent Self-Fix Loop Design

**Status:** Approved design

## Goal

After a user-approved ChangeSet is applied, let the runtime react to verification failures by giving the agent structured failure context and allowing it to propose a new ChangeSet for another user review, with a hard three-attempt limit.

## Design

The repair loop is an orchestration layer around the existing ChangeSet apply and verification boundaries. Verification remains the source of truth. A failed verification is normalized into a `FailureContext`; the agent receives that context plus the task and relevant prior attempt information, and may return a new ChangeSet proposal. The proposal never mutates the workspace directly and must re-enter the existing review/apply boundary.

State transitions are bounded and explicit:

`verifying -> completed` on success; `verifying -> repair_pending` on failure when attempts remain; `repair_pending -> review` after a valid repair ChangeSet is produced; `repair_pending -> failed` when the retry budget is exhausted or no valid repair proposal can be produced. A repair application returns to `verifying`.

The retry budget is three repair attempts per task. The counter is persisted with the task/repair state so process restarts cannot silently reset the limit.

## FailureContext

The runtime exposes a structured failure object rather than passing arbitrary terminal text as the primary contract. It contains:

- verification attempt number
- verification command/check identifier
- exit status or structured failure code
- concise stdout/stderr excerpts with bounded size
- affected file paths when known
- current ChangeSet identifier
- task identifier
- previous repair attempt summaries

Raw logs remain available through existing verification evidence where supported, but the agent prompt receives the bounded structured context.

## Agent boundary

The repair agent consumes `FailureContext` and produces either:

- a valid ChangeSet proposal, or
- a terminal `no_repair_proposal` result.

The agent does not receive unrestricted filesystem or shell access. It uses the existing controlled inspection/proposal tools.

## Safety

- No automatic repair application.
- Every repair proposal requires the same user review gate as the original ChangeSet.
- Path and ChangeSet validation remain centralized in the existing apply boundary.
- Maximum repair attempts: 3.
- No recursive repair of a repair-analysis failure; orchestration owns the retry counter.
- If verification succeeds, the loop terminates immediately.
- If the retry budget is exhausted, the task becomes failed with inspectable verification evidence.

## Testing

Unit tests cover failure normalization, retry-state transitions, attempt limits, proposal/no-proposal outcomes, and restart persistence. Integration coverage exercises `apply -> verify fail -> repair proposal -> review/apply -> verify pass`. A real-provider E2E scenario may be added after the deterministic loop is green; it must preserve the review boundary.
