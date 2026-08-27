import { describe, expect, it } from 'vitest';
import { GenericLanguageAdapter } from './GenericLanguageAdapter.js';

describe('GenericLanguageAdapter', () => {
  it('extracts structural imports and symbols from an unsupported language', () => {
    const adapter = new GenericLanguageAdapter();
    const result = adapter.parse('import "./auth"\nclass LoginService {}\nconst handler = () => null');
    expect(result.imports).toEqual(['./auth']);
    expect(result.symbols).toEqual(['LoginService', 'handler']);
  });

  it('only claims code-like fallback extensions', () => {
    const adapter = new GenericLanguageAdapter();
    expect(adapter.supports('src/example.py')).toBe(true);
    expect(adapter.supports('README.md')).toBe(false);
  });
});
