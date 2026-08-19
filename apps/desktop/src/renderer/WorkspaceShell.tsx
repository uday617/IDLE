import { getWorkspacePanelTitle } from './workspaceModel.js';

export function WorkspaceShell() {
  return (
    <main className="workspace-shell">
      <header className="titlebar">
        <strong>IDLE</strong>
        <span>Multi-agent coding workspace</span>
      </header>
      <section className="workspace-grid">
        <aside className="panel explorer">
          <h2>{getWorkspacePanelTitle('explorer')}</h2>
          <p>Open a project to begin.</p>
        </aside>
        <section className="panel editor">
          <h2>{getWorkspacePanelTitle('editor')}</h2>
          <p>Code editor surface coming next.</p>
        </section>
        <aside className="panel agents">
          <h2>{getWorkspacePanelTitle('agents')}</h2>
          <p>No active agents.</p>
        </aside>
      </section>
      <footer className="statusbar">Foundation ready</footer>
    </main>
  );
}
