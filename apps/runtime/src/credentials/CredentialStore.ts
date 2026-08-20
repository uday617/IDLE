export interface CredentialStoreOptions {
  credentials?: Readonly<Record<string, string>>;
}

export class CredentialStore {
  private readonly credentials: Readonly<Record<string, string>>;

  constructor(options: CredentialStoreOptions = {}) {
    this.credentials = Object.freeze({ ...(options.credentials ?? {}) });
  }

  get(name: string): string | undefined {
    return this.credentials[name];
  }

  redact(value: string): string {
    let redacted = value;
    for (const secret of Object.values(this.credentials)) {
      if (secret) redacted = redacted.split(secret).join('[REDACTED]');
    }
    return redacted;
  }

  redactRecord<T extends Record<string, unknown>>(record: T): T {
    const copy = structuredClone(record);
    const visit = (value: unknown): unknown => {
      if (typeof value === 'string') return this.redact(value);
      if (Array.isArray(value)) return value.map(visit);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
      }
      return value;
    };
    return visit(copy) as T;
  }
}
