import { useEffect, useRef, useState } from 'react';
import type { ChangeSetReviewResult, ProjectId, TaskId, TaskOrchestrationRequest, TaskResult, TaskStatus, TaskStatusEvent } from '@idle/contracts';
import type { ChangeSet } from '@idle/contracts';
import { ChangeSetReview } from './ChangeSetReview.js';
import { Editor } from './Editor.js';
import { FileExplorer } from './FileExplorer.js';
import { TaskWorkspace } from './TaskWorkspace.js';
import { AdvancedTaskForm } from './AdvancedTaskForm.js';
import { getWorkspacePanelTitle } from './workspaceModel.js';
import { getAgentPanelState, getWorkspaceStatus } from './workspaceUiModel.js';
import { beginProjectOpen, completeProjectOpen, failProjectOpen, initialProjectWorkspaceState } from './projectState.js';

const taskStatusLabel: Record<TaskStatus, string> = { queued: 'Queued', planning: 'Planning', running: 'Running', verifying: 'Verifying', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', paused: 'Paused' };
const emptyAgentPanel = getAgentPanelState([]);
type InputMode = 'task' | 'command';

export function WorkspaceShell() {
  const [state, setState] = useState(initialProjectWorkspaceState);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('task');
  const [taskId, setTaskId] = useState<TaskId | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [orchestration, setOrchestration] = useState<TaskOrchestrationRequest | undefined>(undefined);
  const [review, setReview] = useState<ChangeSetReviewResult | null>(null);
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [applying, setApplying] = useState(false);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const taskIdRef = useRef<TaskId | null>(null);

  useEffect(() => window.idle.tasks.subscribe((event: TaskStatusEvent) => {
    if (taskIdRef.current !== event.taskId) return;
    setTaskStatus(event.status);
    setTaskError(event.message ?? null);
  }), []);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    const poll = async () => {
      const result = await window.idle.tasks.get(taskId);
      if (cancelled) return;
      if (result) {
        setTaskResult(result);
        setTaskStatus(result.status);
        setTaskError(result.error ?? null);
        if (result.status === 'completed') {
          setReview(result.changeSetReview ?? null);
          setChangeSet(result.changeSet ?? null);
        }
        if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled' || result.status === 'paused') return;
      }
      window.setTimeout(() => void poll(), 350);
    };
    void poll();
    return () => { cancelled = true; };
  }, [taskId]);

  const openProject = async () => {
    setState(beginProjectOpen());
    setSelectedFile(null);
    try {
      const opened = await window.idle.project.openDialog();
      setState((current) => completeProjectOpen(current, opened));
    } catch (cause) {
      setState((current) => failProjectOpen(current, cause instanceof Error ? cause.message : 'Unable to open project'));
    }
  };

  const focusInput = (mode: InputMode) => { setInputMode(mode); taskInputRef.current?.focus(); };

  const submitTask = async () => {
    const prompt = taskPrompt.trim();
    if (!state.project || !prompt || inputMode !== 'task') return;
    const nextTaskId = crypto.randomUUID() as TaskId;
    taskIdRef.current = nextTaskId;
    setTaskId(nextTaskId);
    setTaskStatus('queued');
    setTaskError(null);
    setTaskResult(null);
    setReview(null);
    setChangeSet(null);
    try {
      await window.idle.tasks.submit({ taskId: nextTaskId, projectId: state.project.id as ProjectId, prompt, ...(orchestration ? { orchestration } : {}) });
      setTaskPrompt('');
    } catch (cause) {
      setTaskStatus('failed');
      setTaskError(cause instanceof Error ? cause.message : 'Unable to submit task');
    }
  };

  const applyChanges = async () => {
    if (!state.project || !changeSet || !review?.valid) return;
    setApplying(true);
    try {
      await window.idle.project.applyChangeSet(state.project.id, changeSet);
      setTaskError(null);
      setReview(null);
      setChangeSet(null);
    } catch (cause) {
      setTaskError(cause instanceof Error ? cause.message : 'Unable to apply changes');
    } finally {
      setApplying(false);
    }
  };

  const workspaceStatus = getWorkspaceStatus({ projectPath: state.project?.path ?? null, dirty: Boolean(changeSet), agentCount: taskResult?.workspace?.agents.length ?? (taskStatus ? 1 : 0) });

  return <main className="workspace-shell">
    <header className="titlebar"><div className="brand-block"><strong>IDLE</strong><span>Multi-agent coding workspace</span></div><div className="top-actions"><button className="action-button" type="button" onClick={() => void openProject()} disabled={state.opening}>{state.opening ? 'Opening…' : 'Open Project'}</button><button className="action-button primary-action" type="button" onClick={() => focusInput('task')} disabled={!state.project}>+ Quick Task</button><AdvancedTaskForm disabled={!state.project} onSubmit={(config) => { setOrchestration(config); focusInput('task'); }}/><button className="icon-button" type="button" onClick={() => focusInput('command')} aria-label="Command search">⌕</button></div></header>
    <div className="taskbar"><label className="quick-task-input"><span>{inputMode === 'command' ? '⌕' : '✦'}</span><input ref={taskInputRef} value={taskPrompt} onChange={(event) => setTaskPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitTask(); }} placeholder={!state.project ? 'Open a project to start a task' : inputMode === 'command' ? 'Search commands, files, and actions…' : orchestration ? 'Advanced Task: describe the engineering work…' : 'Ask IDLE to change, explain, or verify something…'} disabled={!state.project}/><kbd>Enter</kbd></label><span className="taskbar-hint">{taskStatus && taskId ? `Task ${taskId.slice(0, 8)} · ${taskStatusLabel[taskStatus]}${taskError ? ` · ${taskError}` : ''}` : orchestration ? 'Advanced orchestration configured.' : 'AI changes will be reviewed before they are applied.'}</span></div>
    <section className="workspace-grid">
      <aside className="panel explorer-panel"><div className="panel-header"><div><h2>{getWorkspacePanelTitle('explorer')}</h2><span className="panel-subtitle">Project files</span></div></div><FileExplorer projectId={state.project?.id ?? null} selectedPath={selectedFile} onSelectFile={setSelectedFile}/>{state.error ? <p className="error-message" role="alert">{state.error}</p> : null}</aside>
      <section className="panel editor-panel"><div className="panel-header editor-header"><div><h2>{getWorkspacePanelTitle('editor')}</h2><span className="panel-subtitle">{selectedFile ?? 'No file selected'}</span></div><span className="readonly-badge">LOCAL</span></div><Editor projectId={state.project?.id ?? null} filePath={selectedFile}/>{taskResult ? <TaskWorkspace result={taskResult} prompt={taskPrompt}/>: null}</section>
      <aside className="panel agents-panel"><div className="panel-header"><div><h2>{emptyAgentPanel.heading}</h2><span className="panel-subtitle">{taskStatus ? taskStatusLabel[taskStatus] : emptyAgentPanel.summary}</span></div><span className="agent-count">{taskResult?.workspace?.agents.length ?? (taskStatus ? '1' : '0')}</span></div>{taskResult?.workspace?.agents.length ? <div className="agent-card-list compact">{taskResult.workspace.agents.map((agent) => <article className="agent-card" key={agent.agentId}><div className="agent-card-heading"><strong>{agent.role}</strong><span>{agent.status}</span></div><div className="agent-progress"><span style={{ width: `${agent.progress}%` }}/></div><small>{agent.currentAction ?? 'No active action'}</small></article>)}</div> : <div className="agent-empty-state"><div className="agent-orbit">{taskStatus ? '●' : '✦'}</div><strong>{taskStatus ? taskStatusLabel[taskStatus] : 'Ready for agent work'}</strong><p>{taskError ?? (taskStatus ? 'Task lifecycle is connected to the runtime.' : 'Start a Quick Task or Advanced Task and IDLE will show structured progress here.')}</p><button className="secondary-button" type="button" onClick={() => focusInput('task')} disabled={!state.project}>{taskStatus ? 'Start another task' : 'Start a task'}</button></div>}{review ? <ChangeSetReview review={review} applying={applying} onApply={() => void applyChanges()}/>: null}</aside>
    </section>
    <footer className="statusbar"><div className="status-group"><span className="status-dot"/><span>{workspaceStatus.project}</span></div><div className="status-group"><span>{workspaceStatus.changes}</span><span>TypeScript</span><span>UTF-8</span></div><span className="status-ready">{taskStatus ? taskStatusLabel[taskStatus] : 'Ready'}</span></footer>
  </main>;
}
