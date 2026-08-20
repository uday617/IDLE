export const RUNTIME_VERSION = '0.1.0';

export function createAppModel(name: string) {
  return { name } as const;
}
