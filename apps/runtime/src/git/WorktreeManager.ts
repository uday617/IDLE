import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { ProjectService } from '../project/ProjectService.js';

const execGit = promisify(execFile);

export interface Worktree {
  id: string;
  projectId: string;
  taskId: string;
  agentId: string;
  path: string;
  branch: string;
}

export interface MergeResult {
  merged: boolean;
  target: string;
  conflicts: string[];
}

export class WorktreeManager {
  private readonly worktrees = new Map<string, Worktree>();

  constructor(private readonly projects: ProjectService) {}

  async create(projectId: string, taskId: string, agentId: string): Promise<Worktree> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const id = randomUUID();
    const branch = `idle/${this.slug(taskId)}/${this.slug(agentId)}-${id.slice(0, 8)}`;
    const path = join(project.path, '.idle', 'worktrees', id);

    await mkdir(join(project.path, '.idle', 'worktrees'), { recursive: true });
    await this.git(project.path, 'worktree', 'add', '-b', branch, path, 'HEAD');

    const worktree: Worktree = { id, projectId, taskId, agentId, path, branch };
    this.worktrees.set(id, worktree);
    return worktree;
  }

  async remove(worktreeId: string): Promise<void> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) return;

    const project = await this.projects.get(worktree.projectId);
    if (!project) {
      this.worktrees.delete(worktreeId);
      return;
    }

    await this.git(project.path, 'worktree', 'remove', '--force', worktree.path);
    await this.git(project.path, 'branch', '-D', worktree.branch).catch(() => undefined);
    this.worktrees.delete(worktreeId);
  }

  async merge(worktreeId: string, target: string): Promise<MergeResult> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) throw new Error(`Worktree not found: ${worktreeId}`);

    const project = await this.projects.get(worktree.projectId);
    if (!project) throw new Error(`Project not found: ${worktree.projectId}`);

    try {
      await this.git(project.path, 'merge', '--no-edit', worktree.branch);
      return { merged: true, target, conflicts: [] };
    } catch (error) {
      const status = await this.git(project.path, 'status', '--porcelain');
      const conflicts = status
        .split('\n')
        .filter((line) => /^[ MARCUD?]{2} /.test(line) && /^(UU|AA|DD|AU|UA|DU|UD) /.test(line))
        .map((line) => line.slice(3))
        .sort();

      if (conflicts.length === 0) throw error;

      await this.git(project.path, 'merge', '--abort').catch(() => undefined);
      return { merged: false, target, conflicts };
    }
  }

  private async git(cwd: string, ...args: string[]): Promise<string> {
    const { stdout } = await execGit('git', args, { cwd });
    return stdout.trim();
  }

  private slug(value: string): string {
    const slug = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'agent';
  }
}
