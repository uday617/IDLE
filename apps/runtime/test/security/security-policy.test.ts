import { describe, expect, it } from 'vitest';
import { CredentialStore } from '../../src/credentials/CredentialStore.js';
import { SecurityPolicy } from '../../src/security/SecurityPolicy.js';
import { ToolExecutor } from '../../src/agents/tools/ToolExecutor.js';

describe('SecurityPolicy', () => {
  it('rejects paths that traverse outside the project root', () => {
    expect(() => SecurityPolicy.validatePath('/project', '../secrets.txt')).toThrow('Path escapes project root');
    expect(() => SecurityPolicy.validatePath('/project', '/etc/passwd')).toThrow('Path escapes project root');
    expect(() => SecurityPolicy.validatePath('/project', 'src/index.ts')).not.toThrow();
  });

  it('blocks destructive commands and shell control syntax', () => {
    const policy = { allowedCommands: ['git', 'node'] };
    expect(() => SecurityPolicy.validateCommand(policy, 'git reset --hard HEAD')).toThrow('Destructive command is blocked');
    expect(() => SecurityPolicy.validateCommand(policy, 'rm -rf .')).toThrow('Destructive command is blocked');
    expect(() => SecurityPolicy.validateCommand(policy, 'node --version && rm -rf .')).toThrow('Shell control characters are not allowed');
  });

  it('redacts credentials from strings and nested records', () => {
    const store = new CredentialStore({ credentials: { API_KEY: 'secret-123' } });
    expect(store.redact('request secret-123 failed')).toBe('request [REDACTED] failed');
    expect(store.redactRecord({ message: 'secret-123', nested: { value: 'safe' } })).toEqual({
      message: '[REDACTED]',
      nested: { value: 'safe' },
    });
  });

  it('prevents a tool from escaping the command policy boundary', async () => {
    const executor = new ToolExecutor();
    await expect(executor.execute('rm -rf project', '/project', { allowedCommands: ['rm'] })).rejects.toThrow('Destructive command is blocked');
    await expect(executor.execute('python -c "print(1)"', '/project', { allowedCommands: ['node'] })).rejects.toThrow('Command is not allowed: python');
  });
});
