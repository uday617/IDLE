import { describe, expect, it } from 'vitest';
import { getEditorLanguage } from './editorModel.js';

describe('editorModel', () => {
  it('maps common source extensions to Monaco languages', () => {
    expect(getEditorLanguage('src/App.tsx')).toBe('typescript');
    expect(getEditorLanguage('server/index.js')).toBe('javascript');
    expect(getEditorLanguage('README.md')).toBe('markdown');
    expect(getEditorLanguage('styles.css')).toBe('css');
    expect(getEditorLanguage('config.json')).toBe('json');
  });

  it('falls back to plaintext for unknown extensions', () => {
    expect(getEditorLanguage('notes.unknown')).toBe('plaintext');
    expect(getEditorLanguage('Dockerfile')).toBe('plaintext');
  });
});
