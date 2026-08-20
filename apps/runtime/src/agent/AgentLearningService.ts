import type { AgentMemoryService, MemoryEntry } from './AgentMemoryService.js';

export interface LearningTask {
  agentId: string;
  description: string;
  tags?: readonly string[];
}

export interface LearningOutcome {
  success: boolean;
  summary: string;
  tags?: readonly string[];
}

export interface LearningContext {
  memories: MemoryEntry[];
}

export class AgentLearningService {
  constructor(private readonly memory: AgentMemoryService) {}

  recallForTask(task: LearningTask): LearningContext {
    try {
      const words = task.description
        .toLocaleLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4);
      const memories = words.length === 0
        ? this.memory.recall(task.agentId)
        : words.flatMap((word) => this.memory.recall(task.agentId, { text: word }));
      const seen = new Set<string>();
      return {
        memories: memories.filter((entry) => !seen.has(entry.id) && seen.add(entry.id)),
      };
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
}
