import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface Project {
  id: string;
  path: string;
}

export class ProjectService {
  private readonly projects = new Map<string, Project>();

  async open(projectPath: string): Promise<Project> {
    const path = resolve(projectPath);
    const info = await stat(path);

    if (!info.isDirectory()) {
      throw new Error(`Project path is not a directory: ${path}`);
    }

    const project: Project = { id: randomUUID(), path };
    this.projects.set(project.id, project);
    return project;
  }

  async close(projectId: string): Promise<void> {
    this.projects.delete(projectId);
  }

  async get(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) ?? null;
  }
}
