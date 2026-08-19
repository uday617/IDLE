import { useState } from 'react';
import { getWorkspacePanelTitle } from './workspaceModel.js';
import {
  beginProjectOpen,
  completeProjectOpen,
  failProjectOpen,
  initialProjectWorkspaceState,
} from './projectState.js';

export function WorkspaceShell() {
  const [state, setState] = useState(initialProjectWorkspaceState);

  const openProject = async () => {
    setState(beginProjectOpen());
    try {
      const opened = await window.idle.project.openDialog();
      setState((current) => completeProjectOpen(current, opened));
    } catch (cause) {
      setState((current) =>
        failProjectOpen(current, cause instanceof Error ? cause.message : 'Unable to open project'),
      );
    }
  };

  return (
    <main className="workspace-shell">
      <header className="titlebar">
        <strong>IDLE</strong>
        <span>Multi-agent coding workspace</span>
        <button type="button" onClick={() => void openProject()} disabled={state.opening}>
          {state.opening ? 'Opening…' : 'Open Project'}
        </button>
      </header>
      <section className="workspace-grid">
        <aside className="panel explorer">
          <h2>{getWorkspacePanelTitle('explorer')}</h2>
          {state.project ? (
            <p title={state.project.path}>{state.project.path}</p>
          ) : (
            <p>No project opened.</p>
          )}
          {state.error ? <p role="alert">{state.error}</p> : null}
        </aside>
        <section className="panel editor">
          <h2>{getWorkspacePanelTitle('editor')}</h2>
          <p>{state.project ? 'Select a file to start editing.' : 'Open a project to begin.'}</p>
        </section>
        <aside className="panel agents">
          <h2>{getWorkspacePanelTitle('agents')}</h2>
          <p>No active agents.</p>
        </aside>
      </section>
      <footer className="statusbar">
        {state.project ? `Project: ${state.project.path}` : 'Foundation ready'}
      </footer>
    </main>
  );
}
