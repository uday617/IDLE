import { describe, expect, it } from 'vitest';
import { ChangeSetAggregator } from './ChangeSetAggregator.js';
import type { ChangeSet } from '@idle/contracts';

describe('ChangeSetAggregator', () => {
  const change = (id: string, path: string): ChangeSet => ({
    id,
    description: `Change ${id}`,
    changes: [{ operation: 'create', path, baseContent: null, content: `content-${id}` }],
  });

  it('aggregates empty input deterministically', () => {
    expect(new ChangeSetAggregator().aggregate([])).toEqual({
      id: 'changeset-combined-empty',
      description: 'Combined multi-agent changes',
      changes: [],
    });
  });

  it('preserves one ChangeSet metadata and changes', () => {
    const input = change('one', 'src/a.ts');
    expect(new ChangeSetAggregator().aggregate([input])).toEqual(input);
  });

  it('orders compatible changes by path', () => {
    const result = new ChangeSetAggregator().aggregate([change('b', 'src/b.ts'), change('a', 'src/a.ts')]);
    expect(result.id).toBe('changeset-combined-a-b');
    expect(result.changes.map((item) => item.path)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('rejects overlapping target paths', () => {
    expect(() => new ChangeSetAggregator().aggregate([change('a', 'src/shared.ts'), change('b', 'src/shared.ts')])).toThrow('overlapping ChangeSet targets');
  });
});
