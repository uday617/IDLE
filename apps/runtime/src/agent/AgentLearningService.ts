import type { AgentMemoryService, MemoryEntry } from './AgentMemoryService.js';
import type { MemoryMetadata, ProjectFact } from '../memory/MemoryRepository.js';
import type { ProjectMemory } from '../memory/ProjectMemory.js';

export interface LearningTask {
  agentId: string;
  description: string;
  tags?: readonly string[];
  projectId?: string;
}

export interface LearningOutcome {
  success: boolean;
  summary: string;
  tags?: readonly string[];
}

export interface LearningContext {
  memories: MemoryEntry[];
  projectFacts?: ProjectFact[];
}

export class AgentLearningService {
  constructor(
    private readonly memory: AgentMemoryService,
    private readonly projectMemory?: ProjectMemory,
  ) {}

  async recallForTask(task: LearningTask): Promise<LearningContext> {
    try {
      const words = task.description
        .toLocaleLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4);
      const memories = words.length === 0
        ? this.memory.recall(task.agentId)
        : words.flatMap((word) => this.memory.recall(task.agentId, { text: word }));
      const seen = new Set<string>();
      const context: LearningContext = {
        memories: memories.filter((entry) => !seen.has(entry.id) && seen.add(entry.id)),
      };

      if (this.projectMemory && task.projectId === this.projectMemory.id) {
        const projectFacts = await this.projectMemory.retrieveFacts(task.description);
        return { ...context, projectFacts };
      }

      return context;
    } catch {
      return { memories: [] };
    }
  }

  recordOutcome(task: LearningTask, outcome: LearningOutcome): MemoryEntry | null {
    try {
      const tags = [...new Set([...(task.tags ?? []), ...(outcome.tags ?? []), outcome.success ? 'success' : 'failure'])];
      return this.memory.remember(task.agentId, outcome.summary, tags);
    } catch {
      return null;
    }
  }

  async recordProjectFact(
    projectId: string,
    fact: string,
    metadata: MemoryMetadata,
  ): Promise<ProjectFact | null> {
    if (!this.projectMemory || this.projectMemory.id !== projectId) return null;
    try {
      return await this.projectMemory.saveFact(fact, metadata);
    } catch {
      return null;
    }
  }
}
