export interface ShortTermMemoryEntry<T = unknown> {
  id: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
}

export interface ShortTermMemoryOptions {
  ttlMs?: number;
  now?: () => number;
  idFactory?: () => string;
}

export class ShortTermMemory<T = unknown> {
  private readonly entries: ShortTermMemoryEntry<T>[] = [];
  private readonly ttlMs: number | undefined;
  private readonly now: () => number;
  private readonly idFactory: () => string;

  constructor(options: ShortTermMemoryOptions = {}) {
    if (options.ttlMs !== undefined && (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0)) {
      throw new Error('ttlMs must be a positive finite number');
    }
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  append(entry: T): void {
    const createdAt = this.now();
    this.entries.push({
      id: this.idFactory(),
      value: entry,
      createdAt,
      ...(this.ttlMs !== undefined ? { expiresAt: createdAt + this.ttlMs } : {}),
    });
    this.expire();
  }

  list(): T[] {
    this.expire();
    return this.entries.map((entry) => entry.value);
  }

  clear(): void {
    this.entries.length = 0;
  }

  private expire(): void {
    const now = this.now();
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const expiresAt = this.entries[index]?.expiresAt;
      if (expiresAt !== undefined && expiresAt <= now) this.entries.splice(index, 1);
    }
  }
}
