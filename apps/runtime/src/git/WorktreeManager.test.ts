import { execFile } from 'node:child_process';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectService } from '../project/ProjectService.js';
import { WorktreeManager } from './WorktreeManager.js';

const runGit = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await runGit('git', args, { cwd });
  return stdout.trim();
}

async function createRepository(): Promise<{ root: string; branch: string }> {
  const root = await mkdtemp(join(tmpdir(), 'idle-worktree-'));
  await git(root, 'init', '-b', 'main');
  // Keep fixture files byte-for-byte identical across platforms. Git can inherit
  // core.autocrlf=true on Windows runners, which would otherwise rewrite LF to
  // CRLF during worktree checkout and make these merge tests environment-dependent.
  await git(root, 'config', 'core.autocrlf', 'false');
  await git(root, 'config', 'user.name', 'IDLE Test');
  await git(root, 'config', 'user.email', 'idle-test@example.com');
  await writeFile(join(root, 'app.txt'), 'base\n');
  await git(root, 'add', 'app.txt');
  await git(root, 'commit', '-m', 'initial');
  return { root, branch: await git(root, 'branch', '--show-current') };
}

describe('WorktreeManager', () => {
  it('creates and removes an isolated worktree', async () => {
    const { root } = await createRepository();
    const projects = new ProjectService();
    const project = await projects.open(root);
    const manager = new WorktreeManager(projects);

    const worktree = await manager.create(project.id, 'task-1', 'agent-1');

    expect(worktree).toMatchObject({ projectId: project.id, taskId: 'task-1', agentId: 'agent-1' });
    expect(worktree.branch).toContain('idle/task-1/agent-1');
    await expect(stat(worktree.path)).resolves.toBeTruthy();

    await manager.remove(worktree.id);
    await expect(stat(worktree.path)).rejects.toThrow();
  });

  it('merges a clean worktree into the target branch', async () => {
    const { root, branch } = await createRepository();
    const projects = new ProjectService();
    const project = await projects.open(root);
    const manager = new WorktreeManager(projects);
    const worktree = await manager.create(project.id, 'task-2', 'agent-2');

    await writeFile(join(worktree.path, 'app.txt'), 'updated\n');
    await git(worktree.path, 'add', 'app.txt');
    await git(worktree.path, 'commit', '-m', 'agent change');

    await expect(manager.merge(worktree.id, branch)).resolves.toEqual({
      merged: true,
      target: branch,
      conflicts: [],
    });
    await expect(readFile(join(root, 'app.txt'), 'utf8')).resolves.toBe('updated\n');

    await manager.remove(worktree.id);
  });

  it('returns conflict details and leaves the target repository clean', async () => {
    const { root, branch } = await createRepository();
    const projects = new ProjectService();
    const project = await projects.open(root);
    const manager = new WorktreeManager(projects);
    const worktree = await manager.create(project.id, 'task-3', 'agent-3');

    await writeFile(join(worktree.path, 'app.txt'), 'agent change\n');
    await git(worktree.path, 'add', 'app.txt');
    await git(worktree.path, 'commit', '-m', 'agent change');

    await writeFile(join(root, 'app.txt'), 'target change\n');
    await git(root, 'add', 'app.txt');
    await git(root, 'commit', '-m', 'target change');

    await expect(manager.merge(worktree.id, branch)).resolves.toEqual({
      merged: false,
      target: branch,
      conflicts: ['app.txt'],
    });
    await expect(readFile(join(root, 'app.txt'), 'utf8')).resolves.toBe('target change\n');
    await expect(git(root, 'status', '--porcelain')).resolves.toBe('');

    await manager.remove(worktree.id);
  }, 15_000);
});
