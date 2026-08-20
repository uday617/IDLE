export const workspaceActions = [
  { id: 'open-project', label: 'Open Project', shortcut: 'Ctrl+O' },
  { id: 'quick-task', label: 'Quick Task', shortcut: 'Ctrl+K' },
  { id: 'command-search', label: 'Command Search', shortcut: 'Ctrl+Shift+P' },
] as const;

export type AgentStatus = 'queued' | 'working' | 'complete' | 'blocked' | 'failed';

export interface WorkspaceAgent {
  name: string;
  status: AgentStatus;
}

export interface WorkspaceStatusInput {
  projectPath: string | null;
  dirty: boolean;
  agentCount: number;
}

export function getWorkspaceStatus(input: WorkspaceStatusInput) {
  return {
    project: input.projectPath ?? 'No project opened',
    changes: input.dirty ? 'Unsaved changes' : '0 changes',
    agents: input.agentCount === 0 ? 'No active agents' : `${input.agentCount} active agent${input.agentCount === 1 ? '' : 's'}`,
  };
}

export function getAgentPanelState(agents: WorkspaceAgent[]) {
  const counts = agents.reduce<Record<AgentStatus, number>>(
    (result, agent) => ({ ...result, [agent.status]: result[agent.status] + 1 }),
    { queued: 0, working: 0, complete: 0, blocked: 0, failed: 0 },
  );
  const summaryParts = [
    counts.working ? `${counts.working} working` : null,
    counts.queued ? `${counts.queued} queued` : null,
    counts.complete ? `${counts.complete} complete` : null,
    counts.blocked ? `${counts.blocked} blocked` : null,
    counts.failed ? `${counts.failed} failed` : null,
  ].filter((part): part is string => part !== null);

  return {
    heading: 'Agents',
    summary: summaryParts.length ? summaryParts.join(' · ') : 'No active agents',
    agents,
  };
}

export function getAgentStatusLabel(status: AgentStatus): string {
  return {
    queued: 'Queued',
    working: 'Working',
    complete: 'Complete',
    blocked: 'Blocked',
    failed: 'Failed',
  }[status];
}
