import { useEffect, useState } from 'react';

type Props = { projectId: string | null };

export function DeveloperToolsPanel({ projectId }: Props) {
  const [command, setCommand] = useState('git status --short');
  const [output, setOutput] = useState('');
  const [branch, setBranch] = useState('');
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const run = async () => {
    if (!projectId || !command.trim()) return;
    try {
      const result = await window.idle.project.terminalRun(projectId, command.trim());
      if (!result) return;
      setOutput(`${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim() || `exit ${result.exitCode}`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    }
  };
  const refreshGit = async () => {
    if (!projectId) return;
    try {
      const status = await window.idle.project.gitStatus(projectId);
      if (!status) return;
      setBranch(status.branch);
      setChangedFiles([...status.stagedFiles, ...status.changedFiles]);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => { if (open) void refreshGit(); }, [open, projectId]);
  if (!open) return <button className="developer-tools-toggle" type="button" disabled={!projectId} onClick={() => setOpen(true)}>Terminal & Git</button>;
  return <section className="developer-tools-panel">
    <div className="developer-tools-heading"><strong>Developer Tools</strong><div><span>{branch || 'Git'}</span><button type="button" onClick={() => void refreshGit()}>Refresh</button><button type="button" onClick={() => setOpen(false)}>×</button></div></div>
    <div className="developer-tools-grid"><div className="terminal-pane"><label>Integrated Terminal<input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void run(); }} placeholder="Allowed command…"/><button type="button" onClick={() => void run()}>Run</button></label><pre>{output || 'Safe commands: node, pnpm, npm, npx, git, tsc, vitest'}</pre></div><div className="git-pane"><div className="git-pane-title">Working tree</div>{changedFiles.length ? changedFiles.map((file, index) => <code key={`${file}-${index}`}>{file}</code>) : <span>Clean working tree</span>}<button type="button" onClick={async () => { if (!projectId) return; const diff = await window.idle.project.gitDiff(projectId); setOutput(diff ?? 'No diff'); }}>Show diff</button></div></div>
  </section>;
}
