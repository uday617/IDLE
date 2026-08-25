import { describe, expect, it } from 'vitest';
import { LanguageAdapterRegistry } from './LanguageAdapterRegistry.js';
import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter.js';

describe('LanguageAdapterRegistry', () => {
  it('selects the TypeScript adapter for TypeScript-family files', () => {
    const registry = new LanguageAdapterRegistry([new TypeScriptLanguageAdapter()]);

    expect(registry.forPath('src/index.ts')?.id).toBe('typescript');
    expect(registry.forPath('src/component.tsx')?.id).toBe('typescript');
    expect(registry.forPath('README.md')).toBeUndefined();
  });

  it('extracts imports and top-level symbols through the TypeScript adapter', () => {
    const adapter = new TypeScriptLanguageAdapter();
    const source = [
      "import { helper } from './helper.js';",
      "import Service from '../service.js';",
      'export const answer = 42;',
      'export function run() {}',
      'class Worker {}',
    ].join('\n');

    expect(adapter.parse(source)).toEqual({
      imports: ['./helper.js', '../service.js'],
      symbols: ['answer', 'run', 'Worker'],
    });
  });
});
