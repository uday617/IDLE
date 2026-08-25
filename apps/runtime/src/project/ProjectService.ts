import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface Project {
  id: string;
  path: string;
}

interface ProjectStore {
  projects: Project[];
}

export class ProjectService {
  private readonly projects = new Map<string, Project>();

  constructor(private readonly storePath?: string) {}

  async load(): Promise<void> {
    if (!this.storePath) return;

    try {
      const raw = await readFile(this.storePath, 'utf8');
      const store = JSON.parse(raw) as Partial<ProjectStore>;
      this.projects.clear();
      for (const project of store.projects ?? []) {
        if (project?.id && project?.path) {
          this.projects.set(project.id, { id: project.id, path: resolve(project.path) });
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async open(projectPath: string): Promise<Project> {
    const path = resolve(projectPath);
    const info = await stat(path);

    if (!info.isDirectory()) {
      throw new Error(`Project path is not a directory: ${path}`);
    }

    const existing = [...this.projects.values()].find((project) => project.path === path);
    if (existing) return structuredClone(existing);

    const project: Project = { id: randomUUID(), path };
    this.projects.set(project.id, project);
    await this.persist();
    return structuredClone(project);
  }

  async close(projectId: string): Promise<void> {
    this.projects.delete(projectId);
    await this.persist();
  }

  async get(projectId: string): Promise<Project | null> {
    const project = this.projects.get(projectId);
    return project ? structuredClone(project) : null;
  }

  private async persist(): Promise<void> {
    if (!this.storePath) return;
    await mkdir(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify({ projects: [...this.projects.values()] }, null, 2), 'utf8');
    await rename(temporaryPath, this.storePath);
  }
}
