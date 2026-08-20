import { useRef, useState } from 'react';
import { Editor } from './Editor.js';
import { FileExplorer } from './FileExplorer.js';
import { getWorkspacePanelTitle } from './workspaceModel.js';
import {
  getAgentPanelState,
  getWorkspaceStatus,
  workspaceActions,
} from './workspaceUiModel.js';
import {
  beginProjectOpen,
  completeProjectOpen,
  failProjectOpen,
  initialProjectWorkspaceState,
} from './projectState.js';

const emptyAgentPanel = getAgentPanelState([]);

type InputMode = 'task' | 'command';

export function WorkspaceShell() {
  const [state, setState] = useState(initialProjectWorkspaceState);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('task');
  const taskInputRef = useRef<HTMLInputElement>(null);

  const openProject = async () => {
    setState(beginProjectOpen());
    setSelectedFile(null);
    try {
      const opened = await window.idle.project.openDialog();
      setState((current) => completeProjectOpen(current, opened));
    } catch (cause) {
      setState((current) =>
        failProjectOpen(current, cause instanceof Error ? cause.message : 'Unable to open project'),
      );
    }
  };

  const focusInput = (mode: InputMode) => {
    setInputMode(mode);
    taskInputRef.current?.focus();
  };

  const workspaceStatus = getWorkspaceStatus({
    projectPath: state.project?.path ?? null,
    dirty: false,
    agentCount: 0,
  });

  return (
    <main className="workspace-shell">
      <header className="titlebar">
        <div className="brand-block">
          <strong>IDLE</strong>
          <span>Multi-agent coding workspace</span>
        </div>
        <div className="top-actions">
          <button
            className="action-button"
            type="button"
            onClick={() => void openProject()}
            disabled={state.opening}
            title={`${workspaceActions[0].label} (${workspaceActions[0].shortcut})`}
          >
            {state.opening ? 'Opening…' : 'Open Project'}
          </button>
          <button
            className="action-button primary-action"
            type="button"
            onClick={() => focusInput('task')}
            disabled={!state.project}
            title={`${workspaceActions[1].label} (${workspaceActions[1].shortcut})`}
          >
            + Quick Task
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => focusInput('command')}
            title={`${workspaceActions[2].label} (${workspaceActions[2].shortcut})`}
            aria-label="Command search"
          >
            ⌕
          </button>
        </div>
      </header>

      <div className="taskbar">
        <label className="quick-task-input">
          <span aria-hidden="true">{inputMode === 'command' ? '⌕' : '✦'}</span>
          <input
            ref={taskInputRef}
            value={taskPrompt}
            onChange={(event) => setTaskPrompt(event.target.value)}
            placeholder={
              !state.project
                ? 'Open a project to start a task'
                : inputMode === 'command'
                  ? 'Search commands, files, and actions…'
                  : 'Ask IDLE to change, explain, or verify something…'
            }
            disabled={!state.project}
            aria-label={inputMode === 'command' ? 'Command search' : 'Quick Task'}
          />
          <kbd>{inputMode === 'command' ? 'Ctrl Shift P' : 'Ctrl K'}</kbd>
        </label>
        <span className="taskbar-hint">AI changes will be reviewed before they are applied.</span>
      </div>

      <section className="workspace-grid">
        <aside className="panel explorer-panel">
          <div className="panel-header">
            <div>
              <h2>{getWorkspacePanelTitle('explorer')}</h2>
              <span className="panel-subtitle">Project files</span>
            </div>
            <button className="panel-icon-button" type="button" title="Explorer actions" aria-label="Explorer actions">•••</button>
          </div>
          <FileExplorer
            projectId={state.project?.id ?? null}
            selectedPath={selectedFile}
            onSelectFile={setSelectedFile}
          />
          {state.error ? <p className="error-message" role="alert">{state.error}</p> : null}
        </aside>

        <section className="panel editor-panel">
          <div className="panel-header editor-header">
            <div>
              <h2>{getWorkspacePanelTitle('editor')}</h2>
              <span className="panel-subtitle">{selectedFile ?? 'No file selected'}</span>
            </div>
            <div className="editor-header-actions">
              <span className="readonly-badge">LOCAL</span>
            </div>
          </div>
          <Editor projectId={state.project?.id ?? null} filePath={selectedFile} />
        </section>

        <aside className="panel agents-panel">
          <div className="panel-header">
            <div>
              <h2>{emptyAgentPanel.heading}</h2>
              <span className="panel-subtitle">{emptyAgentPanel.summary}</span>
            </div>
            <span className="agent-count">0</span>
          </div>
          <div className="agent-empty-state">
            <div className="agent-orbit" aria-hidden="true">✦</div>
            <strong>Ready for agent work</strong>
            <p>Start a Quick Task and IDLE will show planning, execution, verification, and review here.</p>
            <button className="secondary-button" type="button" onClick={() => focusInput('task')} disabled={!state.project}>
              Start a task
            </button>
          </div>
        </aside>
      </section>

      <footer className="statusbar">
        <div className="status-group">
          <span className="status-dot" aria-hidden="true" />
          <span>{workspaceStatus.project}</span>
        </div>
        <div className="status-group">
          <span>{workspaceStatus.changes}</span>
          <span>TypeScript</span>
          <span>UTF-8</span>
        </div>
        <span className="status-ready">Ready</span>
      </footer>
    </main>
  );
}
