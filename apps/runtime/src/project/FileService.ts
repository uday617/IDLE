import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { ProjectService } from './ProjectService.js';

export interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

export interface FileContent {
  path: string;
  content: string;
}

export class FileService {
  constructor(private readonly projects: ProjectService) {}

  async list(projectId: string, relativePath: string): Promise<FileEntry[]> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const root = resolve(project.path);
    const requested = relativePath === '.' ? root : resolve(root, relativePath);
    const fromRoot = relative(root, requested);
    this.assertInsideProject(fromRoot);

    const entries = await readdir(requested, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.isSymbolicLink())
      .map((entry): FileEntry => ({
        name: entry.name,
        path: fromRoot ? `${fromRoot}/${entry.name}` : entry.name,
        kind: entry.isDirectory() ? 'directory' : 'file',
      }))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  async read(projectId: string, relativePath: string): Promise<FileContent> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const root = resolve(project.path);
    const requested = resolve(root, relativePath);
    const fromRoot = relative(root, requested);
    this.assertInsideProject(fromRoot);

    const info = await stat(requested);
    if (!info.isFile()) throw new Error(`Path is not a file: ${relativePath}`);

    return { path: fromRoot, content: await readFile(requested, 'utf8') };
  }

  async write(projectId: string, relativePath: string, content: string): Promise<void> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const root = resolve(project.path);
    const requested = resolve(root, relativePath);
    const fromRoot = relative(root, requested);
    this.assertInsideProject(fromRoot);

    const info = await stat(requested).catch(() => null);
    if (info && !info.isFile()) throw new Error(`Path is not a file: ${relativePath}`);

    const temporary = `${requested}.idle-tmp-${process.pid}`;
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, requested);
  }

  private assertInsideProject(fromRoot: string): void {
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      throw new Error('Path is outside the project');
    }
  }
}
