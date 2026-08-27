import type { LanguageAdapter, ParsedSource } from './LanguageAdapterRegistry.js';

const IMPORT_PATTERNS = [
  /(?:import|include|require)\s*[\(<\s]*["']([^"'\)>]+)["']/g,
  /from\s+["']([^"']+)["']/g,
];

const SYMBOL_PATTERNS = [
  /\b(?:class|interface|struct|enum|type|function|func|def|fn|module|namespace)\s+([A-Za-z_$][\w$-]*)/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$-]*)\s*=/g,
];
const CODE_EXTENSIONS = new Set(['.py', '.go', '.rs', '.java', '.kt', '.kts', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.rb', '.php', '.swift', '.scala', '.sh', '.bash', '.zsh', '.lua', '.dart', '.ex', '.exs', '.erl', '.hrl', '.fs', '.fsx', '.vb', '.r']);

export class GenericLanguageAdapter implements LanguageAdapter {
  readonly id = 'generic-structural';
  supports(path: string): boolean {
    const dot = path.lastIndexOf('.');
    return dot >= 0 && CODE_EXTENSIONS.has(path.slice(dot).toLowerCase());
  }

  parse(source: string): ParsedSource {
    const imports = new Set<string>();
    const symbols = new Set<string>();
    for (const pattern of IMPORT_PATTERNS) for (const match of source.matchAll(pattern)) if (match[1]) imports.add(match[1]);
    for (const pattern of SYMBOL_PATTERNS) for (const match of source.matchAll(pattern)) if (match[1]) symbols.add(match[1]);
    return { imports: [...imports], symbols: [...symbols] };
  }
}
