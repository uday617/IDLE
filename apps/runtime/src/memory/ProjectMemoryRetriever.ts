import type { AgentMemoryItem, AgentMemoryRetriever } from '../agents/AgentRuntime.js';
import { ProjectMemory } from './ProjectMemory.js';
import type { MemoryRepository } from './MemoryRepository.js';

export class ProjectMemoryRetriever implements AgentMemoryRetriever {
  constructor(private readonly repository: MemoryRepository) {}

  async retrieve(projectId: string, query: string, limit: number): Promise<readonly AgentMemoryItem[]> {
    const memory = new ProjectMemory(projectId, this.repository);
    const facts = await memory.retrieveFacts(query, limit);
    return facts.map((fact) => ({ fact: fact.fact }));
  }
}
