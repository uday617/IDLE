import type { MemoryMetadata, ProjectFact } from '../memory/MemoryRepository.js';
import type { ProjectMemory } from '../memory/ProjectMemory.js';

export class ProjectLearningService<T = string> {
  constructor(private readonly memory: ProjectMemory<T>) {}

  async learn(fact: T, metadata: MemoryMetadata): Promise<ProjectFact<T>> {
    return this.memory.saveFact(fact, metadata);
  }

  async learnVerified(
    fact: T,
    confidence: number,
    source: MemoryMetadata['source'] = 'verification',
  ): Promise<ProjectFact<T>> {
    return this.learn(fact, { confidence, source, validated: true });
  }

  async recall(query: string, limit = 5): Promise<ProjectFact<T>[]> {
    return this.memory.retrieveFacts(query, limit);
  }
}
