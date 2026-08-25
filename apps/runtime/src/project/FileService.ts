import { readFile, readdir, rename, stat, unlink, writeFile, realpath, lstat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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
    await this.assertRealPathInsideProject(root, requested);
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
    await this.assertRealPathInsideProject(project.path, requested);
    const info = await stat(requested);
    if (!info.isFile()) throw new Error(`Path is not a file: ${relativePath}`);
    return { path: relative(resolve(project.path), requested), content: await readFile(requested, 'utf8') };
  }

  async readState(projectId: string, relativePath: string): Promise<FileState> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const requested = this.resolveFilePath(project.path, relativePath);
    await this.assertRealPathInsideProject(project.path, requested);
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

  async restoreBatch(projectId: string, states: Array<{ path: string; state: FileState }>): Promise<void> {
    await this.applyBatch(projectId, states.map(({ path, state }) => ({
      path,
      content: state.exists ? state.content : null,
    })));
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
      await this.assertRealPathInsideProject(root, requested);
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

  private async assertRealPathInsideProject(rootPath: string, requested: string): Promise<void> {
    const root = await realpath(rootPath);
    let candidate = requested;

    while (true) {
      try {
        const resolved = await realpath(candidate);
        this.assertInsideProject(relative(root, resolved));
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

        const parent = dirname(candidate);
        if (parent === candidate) throw error;

        const entry = await lstat(candidate).catch((entryError: unknown) => {
          if ((entryError as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
          throw entryError;
        });
        if (entry?.isSymbolicLink()) throw new Error('Path is outside the project');

        const resolvedParent = await realpath(parent);
        this.assertInsideProject(relative(root, resolvedParent));
        if (basename(candidate) === '') return;
        candidate = parent;
      }
    }
  }

  private assertInsideProject(fromRoot: string): void {
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      throw new Error('Path is outside the project');
    }
  }
}
