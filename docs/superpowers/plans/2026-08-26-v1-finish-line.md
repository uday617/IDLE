# V1 Finish-Line Implementation Plan

Branch: `feat/v1-finish-line`

## Task 1 — Project intelligence foundation
- [ ] Inspect current project/file services and persistence boundaries.
- [ ] Add failing scanner/indexing tests.
- [ ] Implement bounded project scanner and incremental change detection.
- [ ] Add parser/language adapter contract with a safe generic fallback.
- [ ] Verify ignored/binary/generated files are excluded safely.

## Task 2 — Project graph
- [ ] Add failing graph tests for symbols/imports/dependencies and changed-file replacement.
- [ ] Implement minimal persistent graph representation compatible with existing storage.
- [ ] Add traversal with bounded depth/result count.
- [ ] Verify project isolation.

## Task 3 — Targeted context retrieval
- [ ] Add failing relevance tests.
- [ ] Implement task-description-to-project-context retrieval.
- [ ] Combine graph relevance with existing memory retrieval.
- [ ] Enforce context/token budgets.
- [ ] Inject project context into the existing AgentRuntime without duplicating memory logic.

## Task 4 — LLM/security hardening
- [ ] Audit existing provider contract before changing interfaces.
- [ ] Add only missing streaming/token-budget abstractions that are required by actual runtime behavior.
- [ ] Implement/test real Windows credential storage only if current product contract requires it; otherwise document the existing local-safe behavior as an explicit V1 decision.
- [ ] Verify secret redaction and no credential leakage into prompts/logs/project files.

## Task 5 — Recovery hardening
- [ ] Add failing restart-during-task regression test.
- [ ] Verify last-safe-state persistence and paused/resume semantics.
- [ ] Test recovery after verification failure and repair failure.
- [ ] Ensure recovery errors cannot falsely mark a task complete.

## Task 6 — Security boundary audit
- [ ] Test project-root path traversal.
- [ ] Test dangerous command rejection/approval.
- [ ] Test tool argument handling without shell interpolation.
- [ ] Test memory/learning secret filtering.
- [ ] Review logs and audit ledger for sensitive values.

## Task 7 — Full integration
- [ ] Add one deterministic fixture project.
- [ ] Exercise project scan → retrieval → plan → agent → patch → verification.
- [ ] Exercise verification failure → repair → verification success → learning persistence.
- [ ] Exercise multi-agent coordination and integration.
- [ ] Exercise restart/recovery.

## Task 8 — Final Windows acceptance
- [ ] Run typecheck.
- [ ] Run full tests.
- [ ] Run Windows E2E.
- [ ] Build/package Windows application.
- [ ] Run real Nemotron E2E.
- [ ] Execute final acceptance flow against the packaged/development Windows application.
- [ ] Review diff and remove temporary/debug artifacts.
- [ ] Only after all verification is green, open a final PR to main.

## Definition of Done

No known P0/P1 functional gap remains in the approved V1 scope; the complete user-visible loop is proven on Windows with real Nemotron, project-aware context, verification/repair, durable memory/learning, recovery, security boundaries, and inspectable results.
