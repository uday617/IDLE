import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProjectService } from './ProjectService.js';

const execFileAsync = promisify(execFile);

export interface GitStatus { branch: string; clean: boolean; changedFiles: string[]; stagedFiles: string[]; }
export interface GitDiff { diff: string; }

export class GitService {
  constructor(private readonly projects: ProjectService) {}

  async status(projectId: string): Promise<GitStatus> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], { cwd: project.path, windowsHide: true });
    const { stdout: porcelain } = await execFileAsync('git', ['status', '--porcelain=v1'], { cwd: project.path, windowsHide: true });
    const changedFiles: string[] = [];
    const stagedFiles: string[] = [];
    for (const line of porcelain.split(/\r?\n/).filter(Boolean)) {
      const index = line.slice(0, 1);
      const worktree = line.slice(1, 2);
      const path = line.slice(3).trim();
      if (index !== ' ') stagedFiles.push(path);
      if (worktree !== ' ') changedFiles.push(path);
    }
    return { branch: branchOut.trim() || 'HEAD', clean: changedFiles.length === 0 && stagedFiles.length === 0, changedFiles, stagedFiles };
  }

  async diff(projectId: string): Promise<GitDiff> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const { stdout } = await execFileAsync('git', ['diff', '--no-ext-diff', '--'], { cwd: project.path, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    return { diff: stdout };
  }
}
