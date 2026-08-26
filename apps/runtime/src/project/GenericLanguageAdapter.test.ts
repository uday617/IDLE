import { describe, expect, it } from 'vitest';
import { GenericLanguageAdapter } from './GenericLanguageAdapter.js';

describe('GenericLanguageAdapter', () => {
  it('extracts structural imports and symbols from an unsupported language', () => {
    const adapter = new GenericLanguageAdapter();
    const result = adapter.parse('import "./auth"\nclass LoginService {}\nconst handler = () => null');
    expect(result.imports).toEqual(['./auth']);
    expect(result.symbols).toEqual(['LoginService', 'handler']);
  });

  it('is a safe fallback for every path', () => {
    expect(new GenericLanguageAdapter().supports('src/example.unknown')).toBe(true);
  });
});
