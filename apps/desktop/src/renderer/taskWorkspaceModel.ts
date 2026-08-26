import type { AgentStatus, TaskOrchestrationRequest, TaskResult, TaskWorkspaceState } from '@idle/contracts';

export function buildTaskWorkspace(result: TaskResult, prompt: string, orchestration?: TaskOrchestrationRequest): TaskWorkspaceState {
  if (result.workspace) return result.workspace;
  const files = result.changeSet?.changes.map((change) => change.path) ?? [];
  const agentCount = orchestration?.enabled ? Math.max(1, Math.min(orchestration.maxAgents ?? 2, 4)) : 1;
  const agentStatus: AgentStatus = result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'executing';
  const now = new Date().toISOString();
  const agents = Array.from({ length: agentCount }, (_, index) => ({
    agentId: `agent-${index + 1}` as TaskWorkspaceState['agents'][number]['agentId'],
    role: index === 0 ? 'Primary agent' : `Agent ${index + 1}`,
    status: agentStatus,
    progress: result.status === 'completed' || result.status === 'failed' ? 100 : 50,
    currentAction: result.status === 'completed' ? 'Completed task and produced reviewable changes' : result.status === 'failed' ? 'Task failed; inspect recovery information' : 'Executing task',
    claimedPaths: files,
  }));
  return {
    task: { id: result.taskId, title: prompt.slice(0, 72), description: prompt, status: result.status },
    prompt,
    plan: [
      { id: 'understand', title: 'Understand project and task', status: result.status === 'completed' ? 'completed' : 'running' },
      { id: 'execute', title: orchestration?.enabled ? 'Coordinate agent work' : 'Implement controlled changes', status: result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'running' },
      { id: 'review', title: 'Review and verify result', status: result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'pending' },
    ],
    agents,
    files,
    verification: [{ id: 'changeset-review', label: 'ChangeSet validation', status: result.changeSetReview?.valid ? 'passed' : result.status === 'failed' ? 'failed' : 'pending', detail: result.changeSetReview?.valid ? 'Reviewable change set is valid' : result.error ?? 'Waiting for runtime verification' }],
    ledger: [{ id: `${result.taskId}-submitted`, timestamp: now, actor: 'Orchestrator', action: 'Task lifecycle', result: result.status === 'failed' ? 'failed' : 'completed', detail: result.summary ?? result.error ?? 'Task state recorded' }],
    conflicts: [],
    finalReport: result.summary ?? result.error ?? (files.length ? `Prepared ${files.length} changed file(s) for review.` : 'Task completed without a ChangeSet.'),
    ...(orchestration ? { budget: { maxDelegationDepth: orchestration.maxDelegationDepth ?? 2, ...(orchestration.maxTaskTokens ? { maxTaskTokens: orchestration.maxTaskTokens } : {}), ...(orchestration.maxApiCalls ? { maxApiCalls: orchestration.maxApiCalls } : {}), ...(orchestration.idleTimeoutMs ? { idleTimeoutMs: orchestration.idleTimeoutMs } : {}) } } : {}),
  };
}
