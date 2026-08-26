import { useState } from 'react';
import type { TaskOrchestrationRequest } from '@idle/contracts';

type Props = { disabled?: boolean; onSubmit: (config: TaskOrchestrationRequest) => void };

export function AdvancedTaskForm({ disabled, onSubmit }: Props) {
  const [maxAgents, setMaxAgents] = useState(2);
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxApiCalls, setMaxApiCalls] = useState(40);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(60_000);
  const [open, setOpen] = useState(false);

  if (!open) return <button className="secondary-button advanced-toggle" type="button" disabled={disabled} onClick={() => setOpen(true)}>Advanced Task</button>;
  return <form className="advanced-task-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ enabled: true, maxAgents, maxDelegationDepth: maxDepth, maxApiCalls, idleTimeoutMs }); setOpen(false); }}>
    <div className="advanced-form-heading"><strong>Advanced Task</strong><button type="button" aria-label="Close advanced task" onClick={() => setOpen(false)}>×</button></div>
    <label>Agents<input type="number" min={1} max={4} value={maxAgents} onChange={(event) => setMaxAgents(Number(event.target.value))}/></label>
    <label>Delegation depth<input type="number" min={0} max={8} value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))}/></label>
    <label>API-call budget<input type="number" min={1} max={1000} value={maxApiCalls} onChange={(event) => setMaxApiCalls(Number(event.target.value))}/></label>
    <label>Idle timeout (ms)<input type="number" min={1000} max={3_600_000} value={idleTimeoutMs} onChange={(event) => setIdleTimeoutMs(Number(event.target.value))}/></label>
    <button className="action-button primary-action" type="submit">Use Advanced Task</button>
  </form>;
}
