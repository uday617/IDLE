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
  it('opens a file as clean and retains its original content', () => {
    expect(openEditorFile(initialEditorState, 'README.md', 'hello')).toEqual({
      path: 'README.md',
      originalContent: 'hello',
      content: 'hello',
      dirty: false,
      saving: false,
      error: null,
    });
  });

  it('marks changed content dirty and becomes clean when reverted', () => {
    const opened = openEditorFile(initialEditorState, 'README.md', 'hello');
    expect(editEditorContent(opened, 'updated').dirty).toBe(true);
    expect(editEditorContent(opened, 'hello').dirty).toBe(false);
  });

  it('clears dirty state and updates the diff baseline after a successful save', () => {
    const edited = editEditorContent(openEditorFile(initialEditorState, 'README.md', 'hello'), 'updated');
    expect(completeEditorSave(beginEditorSave(edited))).toEqual({
      ...edited,
      originalContent: 'updated',
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
