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

  remember(agentId: string, content: string, tags: readonly string[] = []): MemoryEntry {
    const entry: MemoryEntry = {
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      content,
      tags: [...new Set(tags)],
      createdAt: Date.now(),
    };
    this.entries.set(entry.id, entry);
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
    return this.entries.delete(memoryId);
  }
}
