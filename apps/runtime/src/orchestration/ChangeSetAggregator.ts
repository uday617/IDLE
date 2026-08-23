import path from 'node:path';
import type { ChangeSet } from '@idle/contracts';

const normalize = (value: string): string => path.posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//, '');

export class ChangeSetAggregator {
  aggregate(changeSets: ChangeSet[]): ChangeSet {
    if (changeSets.length === 0) {
      return {
        id: 'changeset-combined-empty',
        description: 'Combined multi-agent changes',
        changes: [],
      };
    }

    if (changeSets.length === 1) {
      const [single] = changeSets;
      return { ...single!, changes: [...single!.changes] };
    }

    const ids = changeSets.map((changeSet) => changeSet.id).sort();
    const seen = new Set<string>();
    const changes = changeSets.flatMap((changeSet) => changeSet.changes.map((change) => ({
      ...change,
      path: normalize(change.path),
    })));

    for (const change of changes) {
      if (seen.has(change.path)) throw new Error(`overlapping ChangeSet targets: ${change.path}`);
      seen.add(change.path);
    }

    changes.sort((a, b) => a.path.localeCompare(b.path) || a.operation.localeCompare(b.operation));
    return {
      id: `changeset-combined-${ids.join('-')}`,
      description: `Combined multi-agent changes: ${ids.join(', ')}`,
      changes,
    };
  }
}
