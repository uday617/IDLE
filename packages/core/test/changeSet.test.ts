import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import {
  applyChangeSet,
  validateChangeSet,
  type ChangeFileState,
} from '../src/changeSet.js';

const modify = (
  path: string,
  baseContent: string,
  oldStart: number,
  oldLines: string[],
  newLines: string[],
): ChangeSet => ({
  id: 'test-change',
  description: 'test',
  changes: [
    {
      operation: 'modify',
      path,
      baseContent,
      hunks: [{ oldStart, oldLines, newLines }],
    },
  ],
});

const files = (entries: Record<string, string>): ReadonlyMap<string, ChangeFileState> =>
  new Map(Object.entries(entries).map(([path, content]) => [path, { exists: true, content }]));

describe('validateChangeSet', () => {
  it.each([
    ['/etc/passwd', 'leading slash'],
    ['../outside.ts', 'parent segment'],
    ['src/../outside.ts', 'embedded parent segment'],
    ['C:/outside.ts', 'drive prefix'],
    ['src\\auth.ts', 'backslash separator'],
    ['', 'empty path'],
    ['src//auth.ts', 'empty path segment'],
  ])('rejects %s (%s)', (path) => {
    const changeSet = modify(path, 'old\n', 1, ['old'], ['new']);
    const result = validateChangeSet(changeSet, files({ [path]: 'old\n' }));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'INVALID_PATH')).toBe(true);
  });

  it('rejects duplicate paths', () => {
    const changeSet: ChangeSet = {
      id: 'duplicate',
      description: 'duplicate',
      changes: [
        {
          operation: 'modify',
          path: 'src/a.ts',
          baseContent: 'a\n',
          hunks: [{ oldStart: 1, oldLines: ['a'], newLines: ['b'] }],
        },
        {
          operation: 'delete',
          path: 'src/a.ts',
          baseContent: 'a\n',
        },
      ],
    };

    const result = validateChangeSet(changeSet, files({ 'src/a.ts': 'a\n' }));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'DUPLICATE_PATH')).toBe(true);
  });

  it('requires exact base content for modify and delete', () => {
    const modifyResult = validateChangeSet(
      modify('src/a.ts', 'planned\n', 1, ['planned'], ['changed']),
      files({ 'src/a.ts': 'stale\n' }),
    );
    const deleteResult = validateChangeSet(
      {
        id: 'delete',
        description: 'delete',
        changes: [{ operation: 'delete', path: 'src/a.ts', baseContent: 'planned\n' }],
      },
      files({ 'src/a.ts': 'stale\n' }),
    );

    expect(modifyResult.errors.some((error) => error.code === 'BASE_MISMATCH')).toBe(true);
    expect(deleteResult.errors.some((error) => error.code === 'BASE_MISMATCH')).toBe(true);
  });

  it('requires create targets to be absent and content to be present', () => {
    const existingResult = validateChangeSet(
      {
        id: 'create',
        description: 'create',
        changes: [{ operation: 'create', path: 'src/new.ts', baseContent: null, content: 'new' }],
      },
      files({ 'src/new.ts': 'already exists' }),
    );
    const missingContentResult = validateChangeSet(
      {
        id: 'create',
        description: 'create',
        changes: [{ operation: 'create', path: 'src/new.ts', baseContent: null, content: undefined as never }],
      },
      new Map(),
    );

    expect(existingResult.errors.some((error) => error.code === 'BASE_MISMATCH')).toBe(true);
    expect(missingContentResult.errors.some((error) => error.code === 'MISSING_CONTENT')).toBe(true);
  });

  it('validates exact hunk context, bounds, ordering, and overlap', () => {
    const content = 'one\ntwo\nthree\nfour\n';
    const cases: ChangeSet[] = [
      modify('src/a.ts', content, 2, ['wrong'], ['changed']),
      modify('src/a.ts', content, 0, ['one'], ['changed']),
      modify('src/a.ts', content, 5, ['five'], ['changed']),
      {
        id: 'unsorted',
        description: 'unsorted',
        changes: [
          {
            operation: 'modify',
            path: 'src/a.ts',
            baseContent: content,
            hunks: [
              { oldStart: 3, oldLines: ['three'], newLines: ['3'] },
              { oldStart: 2, oldLines: ['two'], newLines: ['2'] },
            ],
          },
        ],
      },
      {
        id: 'overlap',
        description: 'overlap',
        changes: [
          {
            operation: 'modify',
            path: 'src/a.ts',
            baseContent: content,
            hunks: [
              { oldStart: 2, oldLines: ['two', 'three'], newLines: ['x'] },
              { oldStart: 3, oldLines: ['three'], newLines: ['y'] },
            ],
          },
        ],
      },
    ];

    expect(validateChangeSet(cases[0], files({ 'src/a.ts': content })).errors.some((e) => e.code === 'HUNK_MISMATCH')).toBe(true);
    expect(validateChangeSet(cases[1], files({ 'src/a.ts': content })).errors.some((e) => e.code === 'INVALID_HUNK')).toBe(true);
    expect(validateChangeSet(cases[2], files({ 'src/a.ts': content })).errors.some((e) => e.code === 'INVALID_HUNK')).toBe(true);
    expect(validateChangeSet(cases[3], files({ 'src/a.ts': content })).errors.some((e) => e.code === 'INVALID_HUNK')).toBe(true);
    expect(validateChangeSet(cases[4], files({ 'src/a.ts': content })).errors.some((e) => e.code === 'INVALID_HUNK')).toBe(true);
  });

  it('accepts a valid modify, create, and delete set', () => {
    const changeSet: ChangeSet = {
      id: 'valid',
      description: 'valid changes',
      changes: [
        {
          operation: 'modify',
          path: 'src/a.ts',
          baseContent: 'one\ntwo\nthree\n',
          hunks: [{ oldStart: 2, oldLines: ['two'], newLines: ['TWO'] }],
        },
        { operation: 'create', path: 'src/new.ts', baseContent: null, content: 'new\n' },
        { operation: 'delete', path: 'src/old.ts', baseContent: 'old\n' },
      ],
    };

    expect(validateChangeSet(
      changeSet,
      new Map([
        ['src/a.ts', { exists: true, content: 'one\ntwo\nthree\n' }],
        ['src/old.ts', { exists: true, content: 'old\n' }],
      ]),
    )).toEqual({ valid: true, errors: [] });
  });
});

describe('applyChangeSet', () => {
  it('applies one hunk without changing unrelated lines', () => {
    const base = 'function first() {\n  return 1;\n}\n\nfunction second() {\n  return 2;\n}\n';
    const result = applyChangeSet(
      modify('src/example.ts', base, 2, ['  return 1;'], ['  return 10;']),
      files({ 'src/example.ts': base }),
    );

    expect(result.changes).toEqual([
      {
        path: 'src/example.ts',
        operation: 'modify',
        content: 'function first() {\n  return 10;\n}\n\nfunction second() {\n  return 2;\n}\n',
      },
    ]);
  });

  it('applies multiple ordered hunks, insertion, and deletion', () => {
    const base = 'one\ntwo\nthree\nfour\n';
    const changeSet: ChangeSet = {
      id: 'multi',
      description: 'multi hunk',
      changes: [
        {
          operation: 'modify',
          path: 'src/a.ts',
          baseContent: base,
          hunks: [
            { oldStart: 1, oldLines: ['one'], newLines: ['ONE'] },
            { oldStart: 3, oldLines: [], newLines: ['inserted'] },
            { oldStart: 4, oldLines: ['three'], newLines: [] },
          ],
        },
      ],
    };

    expect(applyChangeSet(changeSet, files({ 'src/a.ts': base })).changes[0]?.content).toBe(
      'ONE\ntwo\ninserted\nfour\n',
    );
  });

  it('applies create and delete operations', () => {
    const changeSet: ChangeSet = {
      id: 'create-delete',
      description: 'create and delete',
      changes: [
        { operation: 'create', path: 'src/new.ts', baseContent: null, content: 'new\n' },
        { operation: 'delete', path: 'src/old.ts', baseContent: 'old\n' },
      ],
    };

    expect(applyChangeSet(
      changeSet,
      files({ 'src/old.ts': 'old\n' }),
    ).changes).toEqual([
      { path: 'src/new.ts', operation: 'create', content: 'new\n' },
      { path: 'src/old.ts', operation: 'delete', content: null },
    ]);
  });

  it('rejects the entire set before producing any output when one file is stale', () => {
    const changeSet: ChangeSet = {
      id: 'atomic',
      description: 'atomic',
      changes: [
        {
          operation: 'modify',
          path: 'src/good.ts',
          baseContent: 'good\n',
          hunks: [{ oldStart: 1, oldLines: ['good'], newLines: ['changed'] }],
        },
        {
          operation: 'modify',
          path: 'src/stale.ts',
          baseContent: 'planned\n',
          hunks: [{ oldStart: 1, oldLines: ['planned'], newLines: ['changed'] }],
        },
      ],
    };

    expect(() => applyChangeSet(
      changeSet,
      files({ 'src/good.ts': 'good\n', 'src/stale.ts': 'actual\n' }),
    )).toThrow(/BASE_MISMATCH/);
  });

  it('does not mutate the supplied file map', () => {
    const base = 'one\ntwo\n';
    const state = new Map<string, ChangeFileState>([['src/a.ts', { exists: true, content: base }]]);
    applyChangeSet(modify('src/a.ts', base, 2, ['two'], ['changed']), state);

    expect(state.get('src/a.ts')).toEqual({ exists: true, content: base });
  });
});
