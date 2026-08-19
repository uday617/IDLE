import { useEffect, useState } from 'react';
import * as MonacoReact from '@monaco-editor/react';
import type { OnChange } from '@monaco-editor/react';
import { getEditorLanguage } from './editorModel.js';

interface EditorProps {
  projectId: string | null;
  filePath: string | null;
}

export function Editor({ projectId, filePath }: EditorProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!projectId || !filePath) {
      setContent('');
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    void window.idle.project.readFile(projectId, filePath).then((result) => {
      if (!active) return;
      if (!result) {
        setError('Unable to read file');
      } else {
        setContent(result.content);
      }
      setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : 'Unable to read file');
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [projectId, filePath]);

  if (!projectId || !filePath) {
    return <p>Select a file to start editing.</p>;
  }

  if (loading) return <p>Loading {filePath}…</p>;
  if (error) return <p role="alert">{error}</p>;

  const handleChange: OnChange = (value) => setContent(value ?? '');
  const MonacoEditor = MonacoReact.Editor;

  return (
    <div className="editor-view" aria-label={`Editor for ${filePath}`}>
      <MonacoEditor
        height="100%"
        language={getEditorLanguage(filePath)}
        value={content}
        onChange={handleChange}
        theme="vs-dark"
        options={{ minimap: { enabled: false }, automaticLayout: true }}
      />
    </div>
  );
}
