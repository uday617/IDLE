import { useEffect, useState } from 'react';
import * as MonacoReact from '@monaco-editor/react';
import type { OnChange } from '@monaco-editor/react';
import { getEditorLanguage } from './editorModel.js';
import {
  beginEditorSave,
  completeEditorSave,
  editEditorContent,
  failEditorSave,
  initialEditorState,
  openEditorFile,
} from './editorState.js';

interface EditorProps {
  projectId: string | null;
  filePath: string | null;
}

export function Editor({ projectId, filePath }: EditorProps) {
  const [state, setState] = useState(initialEditorState);

  useEffect(() => {
    let active = true;
    if (!projectId || !filePath) {
      setState(initialEditorState);
      return () => {
        active = false;
      };
    }

    setState({ ...initialEditorState, path: filePath });
    void window.idle.project.readFile(projectId, filePath).then((result) => {
      if (!active) return;
      if (!result) {
        setState((current) => failEditorSave(current, 'Unable to read file'));
      } else {
        setState((current) => openEditorFile(current, result.path, result.content));
      }
    }).catch((cause) => {
      if (!active) return;
      setState((current) => failEditorSave(current, cause instanceof Error ? cause.message : 'Unable to read file'));
    });

    return () => {
      active = false;
    };
  }, [projectId, filePath]);

  const save = async () => {
    if (!projectId || !state.path || !state.dirty || state.saving) return;
    setState((current) => beginEditorSave(current));
    try {
      const result = await window.idle.project.writeFile(projectId, state.path, state.content);
      if (!result) throw new Error('Unable to save file');
      setState((current) => completeEditorSave(current));
    } catch (cause) {
      setState((current) => failEditorSave(current, cause instanceof Error ? cause.message : 'Unable to save file'));
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!projectId || !filePath) return <p>Select a file to start editing.</p>;
  if (state.error) return <p role="alert">{state.error}</p>;

  const handleChange: OnChange = (value) => {
    setState((current) => editEditorContent(current, value ?? ''));
  };
  const MonacoEditor = MonacoReact.Editor;

  return (
    <div className="editor-view" aria-label={`Editor for ${filePath}`}>
      <div className="editor-toolbar">
        <span>{state.path}{state.dirty ? ' •' : ''}</span>
        <button type="button" onClick={() => void save()} disabled={!state.dirty || state.saving}>
          {state.saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <MonacoEditor
        height="calc(100% - 36px)"
        language={getEditorLanguage(filePath)}
        value={state.content}
        onChange={handleChange}
        theme="vs-dark"
        options={{ minimap: { enabled: false }, automaticLayout: true }}
      />
    </div>
  );
}
