import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ProjectService } from './ProjectService.js';

export interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

export class FileService {
  constructor(private readonly projects: ProjectService) {}

  async list(projectId: string, relativePath: string): Promise<FileEntry[]> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const root = resolve(project.path);
    const requested = relativePath === '.' ? root : resolve(root, relativePath);
    const fromRoot = relative(root, requested);

    if (isAbsolute(fromRoot) || fromRoot.startsWith(`..${requireSeparator()}`) || fromRoot === '..') {
      throw new Error('Path is outside the project');
    }

    const entries = await readdir(requested, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const childPath = fromRoot ? `${fromRoot}/${entry.name}` : entry.name;
      const kind = entry.isDirectory() ? 'directory' : 'file';
      result.push({ name: entry.name, path: childPath, kind });
    }

    return result.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
}

function requireSeparator(): string {
  return '/';
}
