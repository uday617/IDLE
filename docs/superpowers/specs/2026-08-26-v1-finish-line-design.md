# IDLE V1 Finish-Line Design

## Goal

Finish the Windows-first IDLE V1 without reopening completed architecture or merging historical branches blindly.

## Scope

1. Project intelligence: project scanner, incremental indexing, language/parser abstraction, project graph, targeted context retrieval, bounded context budgets.
2. LLM hardening: provider streaming/token-budget interfaces where the current runtime can support them, and real Windows credential-store integration if required by the existing product contract.
3. Recovery/security hardening: active-task restart/resume verification, checkpoint/recovery coverage, credential/path/command isolation audit.
4. Full integration: project intelligence must feed task planning/execution alongside existing memory and learning.
5. Final acceptance: one Windows end-to-end scenario covering understand → plan → delegate → retrieve → patch → verify → repair → review → recover/integrate → learn.

## Explicit non-goals

- Do not merge historical branches merely because their names match old roadmap tasks.
- Do not rebuild delegation, memory, learning, repair, Windows packaging, or Nemotron functionality already present and green on main.
- Do not migrate persistence to SQLite unless implementation audit proves it is required for V1 correctness/performance; document the decision either way.
- No unrelated feature expansion.

## Success criteria

The finish-line branch must pass typecheck, full tests, Windows E2E, Windows packaging, and real Nemotron E2E. The final acceptance scenario must demonstrate project-aware context retrieval, verified repair/learning, restart recovery, security boundaries, and a final inspectable report.
