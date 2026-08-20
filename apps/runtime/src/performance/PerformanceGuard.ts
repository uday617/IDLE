export interface PerformanceLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxOperationMs: number;
}

export interface ProjectStats {
  files: number;
  totalBytes: number;
}

export class PerformanceGuard {
  constructor(private readonly limits: PerformanceLimits) {}

  validateProject(stats: ProjectStats): void {
    if (stats.files > this.limits.maxFiles) {
      throw new Error(`Project exceeds file limit: ${stats.files} > ${this.limits.maxFiles}`);
    }
    if (stats.totalBytes > this.limits.maxTotalBytes) {
      throw new Error(`Project exceeds size limit: ${stats.totalBytes} > ${this.limits.maxTotalBytes}`);
    }
  }

  assertOperationWithinBudget(startedAt: number): void {
    const elapsed = Date.now() - startedAt;
    if (elapsed > this.limits.maxOperationMs) {
      throw new Error(`Operation exceeded time budget: ${elapsed}ms > ${this.limits.maxOperationMs}ms`);
    }
  }

  measure<T>(operation: () => T): T {
    const startedAt = Date.now();
    const result = operation();
    this.assertOperationWithinBudget(startedAt);
    return result;
  }

  async measureAsync<T>(operation: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    const result = await operation();
    this.assertOperationWithinBudget(startedAt);
    return result;
  }
}
