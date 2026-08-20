import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SecurityPolicy, type CommandPolicy } from '../../security/SecurityPolicy.js';
import { CredentialStore } from '../../credentials/CredentialStore.js';

const execFileAsync = promisify(execFile);

export interface ToolExecutionResult {
  stdout: string;
  stderr: string;
}

export class ToolExecutor {
  constructor(private readonly credentials: CredentialStore = new CredentialStore()) {}

  async execute(command: string, cwd: string, policy: CommandPolicy): Promise<ToolExecutionResult> {
    SecurityPolicy.validateCommand(policy, command);
    const parts = command.trim().split(/\s+/);
    const executable = parts[0];
    if (!executable) throw new Error('Command cannot be empty');
    const args = parts.slice(1);
    const result = await execFileAsync(executable, args, { cwd, windowsHide: true });
    return {
      stdout: this.credentials.redact(result.stdout),
      stderr: this.credentials.redact(result.stderr),
    };
  }
}
