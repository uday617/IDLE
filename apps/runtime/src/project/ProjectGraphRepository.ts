import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { GraphFile } from './ProjectGraph.js';

interface GraphStore {
  projects: Record<string, GraphFile[]>;
}

const EMPTY_STORE: GraphStore = { projects: {} };

export class ProjectGraphRepository {
  private readonly filePath: string;
  private store: GraphStore | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'project-graph.json');
  }

  async save(projectId: string, files: GraphFile[]): Promise<void> {
    const store = await this.loadStore();
    store.projects[projectId] = files.map((file) => ({
      path: file.path,
      imports: [...file.imports],
      symbols: [...file.symbols],
    }));
    await this.persist();
  }

  async load(projectId: string): Promise<GraphFile[]> {
    const store = await this.loadStore();
    return (store.projects[projectId] ?? []).map((file) => ({
      path: file.path,
      imports: [...file.imports],
      symbols: [...file.symbols],
    }));
  }

  async delete(projectId: string): Promise<void> {
    const store = await this.loadStore();
    delete store.projects[projectId];
    await this.persist();
  }

  private async loadStore(): Promise<GraphStore> {
    if (this.store) return this.store;

    try {
      const content = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<GraphStore>;
      this.store = { projects: parsed.projects ?? {} };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code !== 'ENOENT') throw error;
      this.store = structuredClone(EMPTY_STORE);
    }

    return this.store;
  }

  private async persist(): Promise<void> {
    const operation = this.writeQueue.catch(() => undefined).then(async () => {
      const snapshot = JSON.stringify(this.store ?? EMPTY_STORE, null, 2);
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
      await mkdir(dirname(this.filePath), { recursive: true });
      try {
        await writeFile(temporaryPath, snapshot, 'utf8');
        await rename(temporaryPath, this.filePath);
      } finally {
        await unlink(temporaryPath).catch(() => undefined);
      }
    });

    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }
}
