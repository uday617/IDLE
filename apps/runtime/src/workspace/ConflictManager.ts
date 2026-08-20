export type ConflictRisk = 'low' | 'high';
export type ConflictResolution =
  | { strategy: 'serialize'; risk: 'low'; paths: string[] }
  | { strategy: 'worktree'; risk: 'high'; paths: string[] };

export interface ConflictPolicy {
  overlappingPaths: string[];
  changedPaths?: string[];
  impact?: 'low' | 'medium' | 'high';
  risk?: ConflictRisk;
}

/**
 * Decides how overlapping agent work should be coordinated.
 * Low-impact overlap is serialized; high-impact overlap is isolated.
 */
export class ConflictManager {
  async resolve(policy: ConflictPolicy): Promise<ConflictResolution> {
    const paths = [...new Set(policy.overlappingPaths.map((path) => this.normalize(path)).filter(Boolean))].sort();
    if (paths.length === 0) {
      return { strategy: 'serialize', risk: 'low', paths: [] };
    }

    const highRisk = policy.risk === 'high' || policy.impact === 'high';
    return highRisk
      ? { strategy: 'worktree', risk: 'high', paths }
      : { strategy: 'serialize', risk: 'low', paths };
  }

  private normalize(path: string): string {
    return path.replaceAll('\\', '/').replace(/^\.\//, '').trim();
  }
}
