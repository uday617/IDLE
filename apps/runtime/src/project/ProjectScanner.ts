import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import type { ProjectService } from './ProjectService.js';

export interface ProjectFileRecord {
  path: string;
  kind: 'file';
  extension: string;
}

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.vite',
]);

export class ProjectScanner {
  constructor(private readonly projects: ProjectService) {}

  async scan(projectId: string): Promise<ProjectFileRecord[]> {
    const project = await this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const records: ProjectFileRecord[] = [];
    await this.walk(project.path, project.path, records);
    records.sort((left, right) => left.path.localeCompare(right.path));
    return records;
  }

  private async walk(
    root: string,
    directory: string,
    records: ProjectFileRecord[],
  ): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.walk(root, absolutePath, records);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      records.push({
        path: relative(root, absolutePath).split('\\').join('/'),
        kind: 'file',
        extension: extname(entry.name).toLowerCase(),
      });
    }
  }
}
