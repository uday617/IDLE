import { spawn } from 'node:child_process';
import type { CommandPolicy } from './SecurityPolicy.js';
import { SecurityPolicy } from './SecurityPolicy.js';

export interface CommandRunRequest {
  command: string;
  cwd: string;
}

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandPolicyValidator {
  validateCommand(policy: CommandPolicy, command: string): void;
}

export class SecureCommandExecutor {
  constructor(
    private readonly validator: CommandPolicyValidator = SecurityPolicy,
    private readonly policy: CommandPolicy,
  ) {}

  run(request: CommandRunRequest): Promise<CommandRunResult> {
    this.validator.validateCommand(this.policy, request.command);

    const [executable, ...args] = request.command.trim().split(/\s+/);
    if (!executable) throw new Error('Command cannot be empty');

    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: request.cwd,
        shell: false,
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer | string) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }));
    });
  }
}
