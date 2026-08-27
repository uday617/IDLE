import { GenericLanguageAdapter } from './GenericLanguageAdapter.js';

export interface ParsedSource { imports: string[]; symbols: string[]; }
export interface LanguageAdapter { readonly id: string; supports(path: string): boolean; parse(source: string): ParsedSource; }

export class LanguageAdapterRegistry {
  private readonly fallback: LanguageAdapter;
  constructor(private readonly adapters: LanguageAdapter[], fallback: LanguageAdapter = new GenericLanguageAdapter()) { this.fallback = fallback; }
  forPath(path: string): LanguageAdapter | undefined {
    return this.adapters.find((adapter) => adapter.supports(path)) ?? (this.fallback.supports(path) ? this.fallback : undefined);
  }
}
