import { readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
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

export interface FileWrite {
  path: string;
  content: string;
}

export interface FileBatchOperation {
  path: string;
  content: string | null;
}

export interface FileState {
  exists: boolean;
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
    return entries.filter((entry) => !entry.isSymbolicLink()).map((entry): FileEntry => ({
      name: entry.name,
      path: fromRoot ? `${fromRoot}/${entry.name}` : entry.name,
      kind: entry.isDirectory() ? 'directory' : 'file',
    })).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async read(projectId: string, relativePath: string): Promise<FileContent> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const requested = this.resolveFilePath(project.path, relativePath);
    const info = await stat(requested);
    if (!info.isFile()) throw new Error(`Path is not a file: ${relativePath}`);
    return { path: relative(resolve(project.path), requested), content: await readFile(requested, 'utf8') };
  }

  async readState(projectId: string, relativePath: string): Promise<FileState> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const requested = this.resolveFilePath(project.path, relativePath);
    try {
      const info = await stat(requested);
      if (!info.isFile()) throw new Error(`Path is not a file: ${relativePath}`);
      return { exists: true, content: await readFile(requested, 'utf8') };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false, content: '' };
      throw error;
    }
  }

  async write(projectId: string, relativePath: string, content: string): Promise<void> {
    await this.writeBatch(projectId, [{ path: relativePath, content }]);
  }

  async writeBatch(projectId: string, writes: FileWrite[]): Promise<void> {
    await this.applyBatch(projectId, writes.map((write) => ({ path: write.path, content: write.content })));
  }

  async applyBatch(projectId: string, operations: FileBatchOperation[]): Promise<void> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const root = resolve(project.path);
    const seen = new Set<string>();
    const snapshots = new Map<string, FileState>();
    const staged: Array<{ temporary: string; requested: string }> = [];

    for (const operation of operations) {
      const requested = this.resolveFilePath(root, operation.path);
      const fromRoot = relative(root, requested);
      if (seen.has(fromRoot)) throw new Error(`Duplicate file operation: ${operation.path}`);
      seen.add(fromRoot);

      const state = await this.readState(projectId, fromRoot);
      snapshots.set(fromRoot, state);
      if (operation.content !== null) {
        const temporary = `${requested}.idle-tmp-${process.pid}-${staged.length}`;
        await writeFile(temporary, operation.content, 'utf8');
        staged.push({ temporary, requested });
      }
    }

    try {
      for (const operation of operations) {
        const requested = this.resolveFilePath(root, operation.path);
        if (operation.content === null) {
          await unlink(requested);
        } else {
          const item = staged.shift();
          if (!item) throw new Error(`Missing staged file for ${operation.path}`);
          await rename(item.temporary, item.requested);
        }
      }
    } catch (error) {
      for (const item of staged) await unlink(item.temporary).catch(() => undefined);
      for (const [path, state] of snapshots) {
        const requested = this.resolveFilePath(root, path);
        if (state.exists) await writeFile(requested, state.content, 'utf8').catch(() => undefined);
        else await unlink(requested).catch(() => undefined);
      }
      throw error;
    }
  }

  private resolveFilePath(rootPath: string, relativePath: string): string {
    const root = resolve(rootPath);
    const requested = resolve(root, relativePath);
    const fromRoot = relative(root, requested);
    this.assertInsideProject(fromRoot);
    return requested;
  }

  private assertInsideProject(fromRoot: string): void {
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      throw new Error('Path is outside the project');
    }
  }
}
