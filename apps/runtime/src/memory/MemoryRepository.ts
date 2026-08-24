import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type MemorySource = 'user' | 'agent' | 'verification' | 'system';

export interface MemoryMetadata {
  confidence: number;
  source: MemorySource;
  validated: boolean;
}

export interface StoredTaskMemory<T = unknown> {
  taskId: string;
  entry: T;
  createdAt: number;
}

export interface StoredAgentMemory {
  id: string;
  agentId: string;
  content: string;
  tags: readonly string[];
  createdAt: number;
}

export interface ProjectFact<T = string> {
  id: string;
  projectId: string;
  fact: T;
  createdAt: number;
  updatedAt: number;
  metadata: MemoryMetadata;
}

interface MemoryStore {
  taskMemory: StoredTaskMemory[];
  agentMemory: StoredAgentMemory[];
  projectFacts: ProjectFact[];
}

const EMPTY_STORE: MemoryStore = { taskMemory: [], agentMemory: [], projectFacts: [] };

export class MemoryRepository {
  private readonly filePath: string;
  private store: MemoryStore | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'memory.json');
  }

  async saveTaskMemory<T>(taskId: string, entry: T): Promise<void> {
    const store = await this.load();
    store.taskMemory.push({ taskId, entry, createdAt: Date.now() });
    await this.persist();
  }

  async listTaskMemory<T>(taskId: string): Promise<T[]> {
    const store = await this.load();
    return store.taskMemory.filter((item) => item.taskId === taskId).map((item) => item.entry as T);
  }

  async saveAgentMemory(entry: StoredAgentMemory): Promise<void> {
    const store = await this.load();
    const existingIndex = store.agentMemory.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) store.agentMemory[existingIndex] = entry;
    else store.agentMemory.push(entry);
    await this.persist();
  }

  async listAgentMemory(): Promise<StoredAgentMemory[]> {
    const store = await this.load();
    return store.agentMemory.map((entry) => ({ ...entry, tags: [...entry.tags] }));
  }

  async deleteAgentMemory(agentId: string, memoryId: string): Promise<boolean> {
    const store = await this.load();
    const index = store.agentMemory.findIndex((item) => item.id === memoryId && item.agentId === agentId);
    if (index < 0) return false;
    store.agentMemory.splice(index, 1);
    await this.persist();
    return true;
  }

  async saveProjectFact<T>(
    projectId: string,
    fact: T,
    metadata: MemoryMetadata,
    idFactory: () => string = () => crypto.randomUUID(),
  ): Promise<ProjectFact<T>> {
    if (!Number.isFinite(metadata.confidence) || metadata.confidence < 0 || metadata.confidence > 1) {
      throw new Error('confidence must be between 0 and 1');
    }
    if (!metadata.validated) {
      throw new Error('only validated project facts may be persisted');
    }

    const store = await this.load();
    const now = Date.now();
    const existing = store.projectFacts.find(
      (item) => item.projectId === projectId && JSON.stringify(item.fact) === JSON.stringify(fact),
    );
    if (existing) {
      existing.updatedAt = now;
      existing.metadata = metadata;
      await this.persist();
      return existing as ProjectFact<T>;
    }

    const saved: ProjectFact<T> = {
      id: idFactory(),
      projectId,
      fact,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
    store.projectFacts.push(saved as ProjectFact);
    await this.persist();
    return saved;
  }

  async listProjectFacts<T>(projectId: string): Promise<ProjectFact<T>[]> {
    const store = await this.load();
    return store.projectFacts.filter((item) => item.projectId === projectId) as ProjectFact<T>[];
  }

  private async load(): Promise<MemoryStore> {
    if (this.store) return this.store;
    try {
      const content = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<MemoryStore>;
      this.store = {
        taskMemory: parsed.taskMemory ?? [],
        agentMemory: parsed.agentMemory ?? [],
        projectFacts: parsed.projectFacts ?? [],
      };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code !== 'ENOENT') throw error;
      this.store = structuredClone(EMPTY_STORE);
    }
    return this.store;
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.store ?? EMPTY_STORE, null, 2);
    const temporaryPath = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, snapshot, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }
}
