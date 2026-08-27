import type { ReactNode } from 'react';
import type { TaskOrchestrationRequest, TaskResult, TaskWorkspaceState } from '@idle/contracts';
import { buildTaskWorkspace } from './taskWorkspaceModel.js';

type Props = { result: TaskResult | null; prompt: string; orchestration?: TaskOrchestrationRequest | undefined };
const statusLabel: Record<TaskWorkspaceState['task']['status'], string> = { queued: 'Queued', planning: 'Planning', running: 'Running', verifying: 'Verifying', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', paused: 'Paused' };
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="task-workspace-section"><div className="task-workspace-section-title">{title}</div>{children}</section>; }

export function TaskWorkspace({ result, prompt, orchestration }: Props) {
  if (!result) return null;
  const workspace = buildTaskWorkspace(result, prompt, orchestration);
  return <div className="task-workspace" data-testid="task-workspace">
    <div className="task-workspace-summary"><div><span className="eyebrow">TASK</span><h3>{workspace.task.title || prompt}</h3><p>{workspace.task.description || prompt}</p></div><span className={`task-state task-state-${workspace.task.status}`}>{statusLabel[workspace.task.status]}</span></div>
    <Section title="Plan"><ol className="task-plan-list">{workspace.plan.map((step) => <li key={step.id} className={`task-plan-step task-plan-${step.status}`}><span>{step.status === 'completed' ? '✓' : step.status === 'failed' ? '!' : step.status === 'running' ? '●' : '○'}</span><div><strong>{step.title}</strong>{step.description ? <small>{step.description}</small> : null}</div></li>)}</ol></Section>
    <Section title={`Agents · ${workspace.agents.length}`}><div className="agent-card-list">{workspace.agents.map((agent) => <article className="agent-card" key={agent.agentId}><div className="agent-card-heading"><strong>{agent.role}</strong><span>{agent.status}</span></div><div className="agent-progress"><span style={{ width: `${Math.max(0, Math.min(100, agent.progress))}%` }} /></div><small>{agent.currentAction ?? 'Waiting for next action'}</small>{agent.claimedPaths.length ? <small>{agent.claimedPaths.join(' · ')}</small> : null}</article>)}</div></Section>
    <Section title="Verification"><div className="verification-list">{workspace.verification.map((check) => <div className="verification-row" key={check.id}><span>{check.status === 'passed' ? '✓' : check.status === 'failed' ? '×' : check.status === 'running' ? '●' : '○'}</span><strong>{check.label}</strong><span>{check.detail ?? check.status}</span></div>)}</div></Section>
    <Section title={`Files · ${workspace.files.length}`}><div className="task-file-list">{workspace.files.length ? workspace.files.map((file) => <code key={file}>{file}</code>) : <span>No files recorded.</span>}</div></Section>
    <Section title="Conflicts"><div className="conflict-list">{workspace.conflicts.length ? workspace.conflicts.map((conflict) => <div className="conflict-row" key={conflict.id}><strong>{conflict.status}</strong><span>{conflict.paths.join(', ')}</span></div>) : <span>No active conflicts.</span>}</div></Section>
    <Section title="Action Ledger"><div className="ledger-list">{workspace.ledger.slice(-12).map((entry) => <div className="ledger-row" key={entry.id}><time>{new Date(entry.timestamp).toLocaleTimeString()}</time><strong>{entry.actor}</strong><span>{entry.action}</span><span>{entry.result}</span></div>)}</div></Section>
    <Section title="Final Report"><p className="task-report">{workspace.finalReport ?? result.summary ?? 'No final report has been recorded yet.'}</p></Section>
    {workspace.pendingApproval ? <div className="approval-banner" role="alert"><strong>Approval required</strong><span>{workspace.pendingApproval.reason}</span><code>{workspace.pendingApproval.action}{workspace.pendingApproval.target ? ` · ${workspace.pendingApproval.target}` : ''}</code></div> : null}
  </div>;
}
