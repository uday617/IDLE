import { describe, expect, it } from 'vitest';
import { SecurityPolicy } from './SecurityPolicy.js';
import { SecureCommandExecutor } from './SecureCommandExecutor.js';

describe('SecureCommandExecutor', () => {
  it('runs an allowed command and captures output', async () => {
    const executor = new SecureCommandExecutor(SecurityPolicy, {
      allowedCommands: ['node'],
    });

    const result = await executor.run({
      command: 'node -e console.log("verified")',
      cwd: process.cwd(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('verified');
    expect(result.stderr).toBe('');
  });

  it('rejects commands outside the allowlist before spawning', () => {
    const executor = new SecureCommandExecutor(SecurityPolicy, {
      allowedCommands: ['node'],
    });

    expect(() => executor.run({ command: 'npm test', cwd: process.cwd() }))
      .toThrow('Command is not allowed: npm');
  });

  it('rejects shell control syntax before spawning', () => {
    const executor = new SecureCommandExecutor(SecurityPolicy, {
      allowedCommands: ['node'],
    });

    expect(() => executor.run({ command: 'node -e "console.log(1)" && echo unsafe', cwd: process.cwd() }))
      .toThrow('Shell control characters are not allowed');
  });
});
