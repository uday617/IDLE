import type { MemoryRepository, StoredAgentMemory } from '../memory/MemoryRepository.js';

export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  tags: readonly string[];
  createdAt: number;
}

export interface MemoryQuery {
  tag?: string;
  text?: string;
}

export class AgentMemoryService {
  private readonly entries = new Map<string, MemoryEntry>();
  private writeQueue: Promise<void> = Promise.resolve();
  private initialized = false;

  constructor(private readonly repository?: MemoryRepository) {}

  async initialize(): Promise<void> {
    if (this.initialized || !this.repository) {
      this.initialized = true;
      return;
    }

    const stored = await this.repository.listAgentMemory();
    this.entries.clear();
    for (const entry of stored) this.entries.set(entry.id, this.fromStored(entry));
    this.initialized = true;
  }

  remember(agentId: string, content: string, tags: readonly string[] = []): MemoryEntry {
    const entry: MemoryEntry = {
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      content,
      tags: [...new Set(tags)],
      createdAt: Date.now(),
    };
    this.entries.set(entry.id, entry);
    if (this.repository) {
      this.writeQueue = this.writeQueue.then(() => this.repository!.saveAgentMemory(this.toStored(entry)));
    }
    return entry;
  }

  recall(agentId: string, query: MemoryQuery = {}): MemoryEntry[] {
    const text = query.text?.toLocaleLowerCase();
    return [...this.entries.values()]
      .filter((entry) => entry.agentId === agentId)
      .filter((entry) => !query.tag || entry.tags.includes(query.tag))
      .filter((entry) => !text || entry.content.toLocaleLowerCase().includes(text))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  forget(agentId: string, memoryId: string): boolean {
    const entry = this.entries.get(memoryId);
    if (!entry || entry.agentId !== agentId) return false;
    const deleted = this.entries.delete(memoryId);
    if (deleted && this.repository) {
      this.writeQueue = this.writeQueue.then(() => this.repository!.deleteAgentMemory(agentId, memoryId).then(() => undefined));
    }
    return deleted;
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private toStored(entry: MemoryEntry): StoredAgentMemory {
    return {
      id: entry.id,
      agentId: entry.agentId,
      content: entry.content,
      tags: [...entry.tags],
      createdAt: entry.createdAt,
    };
  }

  private fromStored(entry: StoredAgentMemory): MemoryEntry {
    return {
      id: entry.id,
      agentId: entry.agentId,
      content: entry.content,
      tags: [...entry.tags],
      createdAt: entry.createdAt,
    };
  }
}
