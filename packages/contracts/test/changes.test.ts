import { describe, expect, it } from 'vitest';
import type {
  ChangeSet,
  CreateChange,
  DeleteChange,
  ModifyChange,
  TextHunk,
} from '../src/index.js';

describe('change set contracts', () => {
  it('models an ordered modify change with exact base content and hunks', () => {
    const hunk: TextHunk = {
      oldStart: 2,
      oldLines: ['const oldValue = 1;'],
      newLines: ['const newValue = 2;'],
    };
    const change: ModifyChange = {
      operation: 'modify',
      path: 'src/example.ts',
      baseContent: 'function example() {\nconst oldValue = 1;\n}',
      hunks: [hunk],
    };

    expect(change).toEqual({
      operation: 'modify',
      path: 'src/example.ts',
      baseContent: 'function example() {\nconst oldValue = 1;\n}',
      hunks: [hunk],
    });
  });

  it('models create and delete operations with their required base-content shapes', () => {
    const create: CreateChange = {
      operation: 'create',
      path: 'src/new.ts',
      baseContent: null,
      content: 'export const value = 1;\n',
    };
    const del: DeleteChange = {
      operation: 'delete',
      path: 'src/old.ts',
      baseContent: 'export const oldValue = 1;\n',
    };

    expect(create.baseContent).toBeNull();
    expect(create.content).toContain('value');
    expect(del.baseContent).toContain('oldValue');
  });

  it('allows a change set to contain multiple file operations', () => {
    const changeSet: ChangeSet = {
      id: 'change-1',
      description: 'Update example files',
      changes: [
        {
          operation: 'modify',
          path: 'src/example.ts',
          baseContent: 'old\n',
          hunks: [{ oldStart: 1, oldLines: ['old'], newLines: ['new'] }],
        },
        {
          operation: 'create',
          path: 'src/new.ts',
          baseContent: null,
          content: 'new file\n',
        },
        {
          operation: 'delete',
          path: 'src/unused.ts',
          baseContent: 'unused\n',
        },
      ],
    };

    expect(changeSet.changes).toHaveLength(3);
    expect(changeSet.changes.map((change) => change.path)).toEqual([
      'src/example.ts',
      'src/new.ts',
      'src/unused.ts',
    ]);
  });
});
