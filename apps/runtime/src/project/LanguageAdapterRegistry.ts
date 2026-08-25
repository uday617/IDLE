export interface ParsedSource {
  imports: string[];
  symbols: string[];
}

export interface LanguageAdapter {
  readonly id: string;
  supports(path: string): boolean;
  parse(source: string): ParsedSource;
}

export class LanguageAdapterRegistry {
  constructor(private readonly adapters: LanguageAdapter[]) {}

  forPath(path: string): LanguageAdapter | undefined {
    return this.adapters.find((adapter) => adapter.supports(path));
  }
}
