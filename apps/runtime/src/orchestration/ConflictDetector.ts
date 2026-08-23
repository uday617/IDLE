import type { AgentRunRecord } from '@idle/contracts';
import path from 'node:path';

export interface ConflictReport {
  conflicts: Array<{ subtaskIds: string[]; paths: string[] }>;
}

const normalize = (value: string): string => {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    return normalized;
  }
  return normalized;
};

export class ConflictDetector {
  detect(runs: AgentRunRecord[]): ConflictReport {
    const owners = new Map<string, string[]>();
    for (const run of runs) {
      for (const rawPath of run.claimedPaths) {
        const normalized = normalize(rawPath);
        if (!normalized || normalized === '.' || normalized.startsWith('../')) continue;
        const current = owners.get(normalized) ?? [];
        current.push(run.subtaskId);
        owners.set(normalized, current);
      }
    }

    const conflicts = [...owners.entries()]
      .filter(([, subtaskIds]) => new Set(subtaskIds).size > 1)
      .map(([pathName, subtaskIds]) => ({
        subtaskIds: [...new Set(subtaskIds)].sort(),
        paths: [pathName],
      }))
      .sort((a, b) => a.paths[0]!.localeCompare(b.paths[0]!));

    return { conflicts };
  }
}
