import type { MemoryRepository, MemoryMetadata, ProjectFact } from './MemoryRepository.js';

export class ProjectMemory<T = string> {
  constructor(
    private readonly projectId: string,
    private readonly repository: MemoryRepository,
  ) {
    if (!projectId) throw new Error('projectId is required');
  }

  async saveFact(fact: T, metadata: MemoryMetadata): Promise<ProjectFact<T>> {
    return this.repository.saveProjectFact(this.projectId, fact, metadata);
  }

  async listFacts(): Promise<ProjectFact<T>[]> {
    return this.repository.listProjectFacts<T>(this.projectId);
  }

  async retrieveFacts(query: string, limit = 5): Promise<ProjectFact<T>[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
    const normalized = query.trim().toLowerCase();
    const facts = await this.listFacts();
    if (!normalized) return facts.slice(0, limit);

    return facts
      .map((fact) => ({ fact, score: this.score(JSON.stringify(fact.fact).toLowerCase(), normalized) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.fact.updatedAt - a.fact.updatedAt)
      .slice(0, limit)
      .map((item) => item.fact);
  }

  private score(text: string, query: string): number {
    return query
      .split(/\s+/)
      .filter(Boolean)
      .reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
  }
}
