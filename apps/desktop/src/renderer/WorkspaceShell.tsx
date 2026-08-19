import { useState } from 'react';
import { getWorkspacePanelTitle } from './workspaceModel.js';

export function WorkspaceShell() {
  const [project, setProject] = useState<{ id: string; path: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openProject = async () => {
    setOpening(true);
    setError(null);
    try {
      const opened = await window.idle.project.openDialog();
      if (opened) setProject(opened);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open project');
    } finally {
      setOpening(false);
    }
  };

  return (
    <main className="workspace-shell">
      <header className="titlebar">
        <strong>IDLE</strong>
        <span>Multi-agent coding workspace</span>
        <button type="button" onClick={() => void openProject()} disabled={opening}>
          {opening ? 'Opening…' : 'Open Project'}
        </button>
      </header>
      <section className="workspace-grid">
        <aside className="panel explorer">
          <h2>{getWorkspacePanelTitle('explorer')}</h2>
          {project ? <p title={project.path}>{project.path}</p> : <p>No project opened.</p>}
          {error ? <p role="alert">{error}</p> : null}
        </aside>
        <section className="panel editor">
          <h2>{getWorkspacePanelTitle('editor')}</h2>
          <p>{project ? 'Select a file to start editing.' : 'Open a project to begin.'}</p>
        </section>
        <aside className="panel agents">
          <h2>{getWorkspacePanelTitle('agents')}</h2>
          <p>No active agents.</p>
        </aside>
      </section>
      <footer className="statusbar">
        {project ? `Project: ${project.path}` : 'Foundation ready'}
      </footer>
    </main>
  );
}
