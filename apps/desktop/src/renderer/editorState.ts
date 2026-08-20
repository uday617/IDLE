export interface EditorState {
  path: string | null;
  originalContent: string;
  content: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

export const initialEditorState: EditorState = {
  path: null,
  originalContent: '',
  content: '',
  dirty: false,
  saving: false,
  error: null,
};

export function openEditorFile(state: EditorState, path: string, content: string): EditorState {
  return { path, originalContent: content, content, dirty: false, saving: false, error: null };
}

export function editEditorContent(state: EditorState, content: string): EditorState {
  return { ...state, content, dirty: content !== state.originalContent };
}

export function beginEditorSave(state: EditorState): EditorState {
  return { ...state, saving: true, error: null };
}

export function completeEditorSave(state: EditorState): EditorState {
  return { ...state, originalContent: state.content, dirty: false, saving: false, error: null };
}

export function failEditorSave(state: EditorState, error: string): EditorState {
  return { ...state, saving: false, error };
}
