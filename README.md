# IDLE

Multi-agent coding IDE — understand, plan, delegate, patch, verify, and integrate.

## Development

V1 is Windows-first and uses a local agent runtime with Nemotron behind a replaceable LLM provider abstraction.

- Design specification: `2026-08-19-multi-agent-ide-design (1).md`
- Final completion plan: `docs/superpowers/plans/2026-08-27-idle-v1-final-completion.md`

The final completion plan is the active finish-line checklist. It covers the desktop Task Workspace, Advanced Task controls, terminal/Git, secure model settings, orchestration hardening, project-intelligence fallback, verification evidence, Windows product E2E, packaging, and release audit.

## V1 workflow

1. Open an existing Windows project.
2. Let IDLE inspect project structure and build targeted context.
3. Create a Quick Task or configure an Advanced Task.
4. Review agent/task progress and proposed changes.
5. Inspect the ChangeSet and verification evidence.
6. Apply approved changes or recover/rollback failed work.
7. Use the integrated terminal/Git surfaces for developer validation.
