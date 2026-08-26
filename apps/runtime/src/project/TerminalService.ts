import { spawn } from 'node:child_process';
import type { ProjectService } from './ProjectService.js';

const ALLOWED_EXECUTABLES = new Set(['node', 'pnpm', 'npm', 'npx', 'git', 'tsc', 'vitest']);
const BLOCKED = /(^|\s)(rm|rmdir|del|format|shutdown|reboot)(\s|$)|git\s+(reset\s+--hard|clean\s+-fd)|[;&|`$<>\n\r]/i;

export interface TerminalResult { exitCode: number; stdout: string; stderr: string; }

export class TerminalService {
  constructor(private readonly projects: ProjectService) {}

  async run(projectId: string, command: string): Promise<TerminalResult> {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const trimmed = command.trim();
    if (!trimmed) throw new Error('Command cannot be empty');
    if (BLOCKED.test(trimmed)) throw new Error('Command contains blocked or shell-control syntax');
    const [executable, ...args] = trimmed.split(/\s+/);
    if (!ALLOWED_EXECUTABLES.has(executable.toLowerCase())) throw new Error(`Command is not allowed: ${executable}`);
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { cwd: project.path, shell: false, windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer | string) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }));
    });
  }
}
