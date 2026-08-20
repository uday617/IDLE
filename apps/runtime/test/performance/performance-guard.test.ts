import { describe, expect, it } from 'vitest';
import { PerformanceGuard } from '../../src/performance/PerformanceGuard.js';

describe('PerformanceGuard', () => {
  const guard = new PerformanceGuard({ maxFiles: 100, maxTotalBytes: 10_000, maxOperationMs: 50 });

  it('allows projects within configured limits', () => {
    expect(() => guard.validateProject({ files: 20, totalBytes: 2_000 })).not.toThrow();
  });

  it('rejects projects above the file limit', () => {
    expect(() => guard.validateProject({ files: 101, totalBytes: 2_000 })).toThrow('file limit');
  });

  it('rejects projects above the size limit', () => {
    expect(() => guard.validateProject({ files: 20, totalBytes: 10_001 })).toThrow('size limit');
  });

  it('enforces the operation time budget', async () => {
    await expect(guard.measureAsync(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return 'done';
    })).rejects.toThrow('time budget');
  });

  it('supports synchronous operations within budget', () => {
    expect(guard.measure(() => 42)).toBe(42);
  });

  it('does not alter the original operation result', async () => {
    await expect(guard.measureAsync(async () => ({ files: 2, totalBytes: 20 }))).resolves.toEqual({ files: 2, totalBytes: 20 });
  });
});
