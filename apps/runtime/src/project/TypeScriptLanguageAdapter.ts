import { extname } from 'node:path';
import type { LanguageAdapter, ParsedSource } from './LanguageAdapterRegistry.js';

const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

export class TypeScriptLanguageAdapter implements LanguageAdapter {
  readonly id = 'typescript';

  supports(path: string): boolean {
    return TYPESCRIPT_EXTENSIONS.has(extname(path).toLowerCase());
  }

  parse(source: string): ParsedSource {
    const imports = [...source.matchAll(/\bimport\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value));

    const symbols = [
      ...source.matchAll(/\b(?:export\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g),
    ]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value));

    return {
      imports: [...new Set(imports)],
      symbols: [...new Set(symbols)],
    };
  }
}
