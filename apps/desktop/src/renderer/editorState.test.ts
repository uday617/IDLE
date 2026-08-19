import { describe, expect, it } from 'vitest';
import {
  beginEditorSave,
  completeEditorSave,
  editEditorContent,
  failEditorSave,
  initialEditorState,
  openEditorFile,
} from './editorState.js';

describe('editorState', () => {
  it('opens a file as clean', () => {
    expect(openEditorFile(initialEditorState, 'README.md', 'hello')).toEqual({
      path: 'README.md',
      content: 'hello',
      dirty: false,
      saving: false,
      error: null,
    });
  });

  it('marks changed content dirty', () => {
    const opened = openEditorFile(initialEditorState, 'README.md', 'hello');
    expect(editEditorContent(opened, 'updated').dirty).toBe(true);
  });

  it('clears dirty state after a successful save', () => {
    const edited = editEditorContent(openEditorFile(initialEditorState, 'README.md', 'hello'), 'updated');
    expect(completeEditorSave(beginEditorSave(edited))).toEqual({
      ...edited,
      dirty: false,
      saving: false,
      error: null,
    });
  });

  it('keeps dirty state when save fails', () => {
    const edited = editEditorContent(openEditorFile(initialEditorState, 'README.md', 'hello'), 'updated');
    expect(failEditorSave(beginEditorSave(edited), 'disk full')).toEqual({
      ...edited,
      saving: false,
      error: 'disk full',
    });
  });
});
