import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FileEntry } from '../preload.js';

interface FileExplorerProps {
  projectId: string | null;
}

export function FileExplorer({ projectId }: FileExplorerProps) {
  const [entries, setEntries] = useState<Record<string, FileEntry[]>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries({});
    setExpanded([]);
    setError(null);
    if (!projectId) return;

    void loadDirectory(projectId, '.', setEntries, setError);
  }, [projectId]);

  if (!projectId) return <p>No project opened.</p>;

  const toggleDirectory = async (path: string) => {
    setError(null);
    if (expanded.includes(path)) {
      setExpanded((current) => current.filter((item) => item !== path));
      return;
    }

    if (!entries[path]) {
      await loadDirectory(projectId, path, setEntries, setError);
    }
    setExpanded((current) => [...current, path]);
  };

  return (
    <div className="file-explorer" role="tree" aria-label="Project files">
      {(entries['.'] ?? []).map((entry) => (
        <ExplorerEntry
          key={entry.path}
          entry={entry}
          entries={entries}
          expanded={expanded}
          onToggle={toggleDirectory}
          depth={0}
        />
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

interface ExplorerEntryProps {
  entry: FileEntry;
  entries: Record<string, FileEntry[]>;
  expanded: string[];
  onToggle(path: string): Promise<void>;
  depth: number;
}

function ExplorerEntry({ entry, entries, expanded, onToggle, depth }: ExplorerEntryProps) {
  const isExpanded = expanded.includes(entry.path);

  return (
    <div role="treeitem" aria-expanded={entry.kind === 'directory' ? isExpanded : undefined}>
      <button
        className="file-entry"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        type="button"
        onClick={() => (entry.kind === 'directory' ? void onToggle(entry.path) : undefined)}
      >
        <span aria-hidden="true">{entry.kind === 'directory' ? (isExpanded ? '▾' : '▸') : '·'}</span>
        <span>{entry.name}</span>
      </button>
      {entry.kind === 'directory' && isExpanded
        ? (entries[entry.path] ?? []).map((child) => (
            <ExplorerEntry
              key={child.path}
              entry={child}
              entries={entries}
              expanded={expanded}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  );
}

async function loadDirectory(
  projectId: string,
  path: string,
  setEntries: Dispatch<SetStateAction<Record<string, FileEntry[]>>>,
  setError: Dispatch<SetStateAction<string | null>>,
) {
  try {
    const result = await window.idle.project.listFiles(projectId, path);
    if (result) setEntries((current) => ({ ...current, [path]: result }));
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : 'Unable to read project files');
  }
}
