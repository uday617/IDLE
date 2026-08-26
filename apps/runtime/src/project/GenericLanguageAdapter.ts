import type { LanguageAdapter, ParsedSource } from './LanguageAdapterRegistry.js';

const IMPORT_PATTERNS = [
  /(?:import|include|require)\s*[\(<\s]*["']([^"'\)>]+)["']/g,
  /from\s+["']([^"']+)["']/g,
];

const SYMBOL_PATTERNS = [
  /\b(?:class|interface|struct|enum|type|function|func|def|fn|module|namespace)\s+([A-Za-z_$][\w$-]*)/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$-]*)\s*=/g,
];

export class GenericLanguageAdapter implements LanguageAdapter {
  readonly id = 'generic-structural';
  supports(_path: string): boolean { return true; }

  parse(source: string): ParsedSource {
    const imports = new Set<string>();
    const symbols = new Set<string>();
    for (const pattern of IMPORT_PATTERNS) {
      for (const match of source.matchAll(pattern)) if (match[1]) imports.add(match[1]);
    }
    for (const pattern of SYMBOL_PATTERNS) {
      for (const match of source.matchAll(pattern)) if (match[1]) symbols.add(match[1]);
    }
    return { imports: [...imports], symbols: [...symbols] };
  }
}
