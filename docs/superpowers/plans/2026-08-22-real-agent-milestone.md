# Real Agent Milestone Plan

## Goal

Connect the existing provider-independent agent runtime to a real local LLM while preserving review-first file changes and deterministic CI.

## Work slices in one PR

1. Add local OpenAI-compatible provider configuration with safe environment defaults.
2. Add repository inspection tools and review-only proposal tools.
3. Wire `IDLE_AGENT_MODE=llm` into task execution without changing the deterministic fallback path.
4. Preserve the existing ChangeSet review/apply/verification boundary; proposal tools never write files.
5. Add tests for configuration, path safety, proposal buffering, and system guidance.
6. Verify CI and Windows Package before merge.

## Safety invariants

- No model shell access in this milestone.
- No direct model writes to the filesystem.
- Every change is represented as a ChangeSet before apply.
- Existing ChangeSet validation and verification remain the write boundary.
- CI never contacts a real model provider.
- Agent loop remains bounded at eight turns.
