import { relative, resolve, sep } from 'node:path';

export interface CommandPolicy {
  allowedCommands: readonly string[];
  blockedCommands?: readonly RegExp[];
}

const DEFAULT_BLOCKED_COMMANDS = [
  /(^|\s)(rm|rmdir|del|format)(\s|$)/i,
  /git\s+(reset\s+--hard|clean\s+-fd)/i,
  /(^|\s)(shutdown|reboot)(\s|$)/i,
];

const SHELL_CONTROL = /[;&|`$<>\n\r]/;

export class SecurityPolicy {
  static validatePath(projectRoot: string, candidate: string): void {
    const root = resolve(projectRoot);
    const target = resolve(root, candidate);
    const relativePath = relative(root, target);

    if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || relativePath.startsWith('/')) {
      throw new Error('Path escapes project root');
    }
  }

  static validateCommand(policy: CommandPolicy, command: string): void {
    const trimmed = command.trim();
    if (!trimmed) throw new Error('Command cannot be empty');
    if (SHELL_CONTROL.test(trimmed)) throw new Error('Shell control characters are not allowed');

    const executable = trimmed.split(/\s+/)[0];
    if (!executable) throw new Error('Command cannot be empty');

    const blocked = [...DEFAULT_BLOCKED_COMMANDS, ...(policy.blockedCommands ?? [])];
    if (blocked.some((pattern) => pattern.test(trimmed))) {
      throw new Error('Destructive command is blocked');
    }

    if (!policy.allowedCommands.map((value) => value.toLowerCase()).includes(executable.toLowerCase())) {
      throw new Error(`Command is not allowed: ${executable.toLowerCase()}`);
    }
  }
}
