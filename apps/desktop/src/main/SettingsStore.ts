import { app, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ProviderSettings { baseUrl: string; model: string; apiKey?: string; timeoutMs: number; }
type StoredSettings = { baseUrl: string; model: string; timeoutMs: number; encryptedApiKey?: string };

export class SettingsStore {
  private readonly path = join(app.getPath('userData'), 'settings.json');

  async get(): Promise<ProviderSettings> {
    const defaults: ProviderSettings = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'nemotron-3-nano:4b', timeoutMs: 120_000 };
    try {
      const stored = JSON.parse(await readFile(this.path, 'utf8')) as StoredSettings;
      const apiKey = stored.encryptedApiKey && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(stored.encryptedApiKey, 'base64')) : undefined;
      return { ...defaults, ...stored, ...(apiKey ? { apiKey } : {}) };
    } catch {
      return defaults;
    }
  }

  async set(settings: ProviderSettings): Promise<ProviderSettings> {
    if (!Number.isInteger(settings.timeoutMs) || settings.timeoutMs < 1) throw new Error('Timeout must be a positive integer');
    const stored: StoredSettings = { baseUrl: settings.baseUrl.trim(), model: settings.model.trim(), timeoutMs: settings.timeoutMs };
    if (settings.apiKey?.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure desktop storage is unavailable');
      stored.encryptedApiKey = safeStorage.encryptString(settings.apiKey.trim()).toString('base64');
    }
    await writeFile(this.path, JSON.stringify(stored, null, 2), 'utf8').catch(async (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await writeFile(this.path, JSON.stringify(stored, null, 2), 'utf8');
    });
    await writeFile(this.path, JSON.stringify(stored, null, 2), 'utf8');
    return settings;
  }
}
