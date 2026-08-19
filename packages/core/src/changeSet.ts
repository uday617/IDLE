import type { ChangeSet, ChangeSetValidationError, FileChange, TextHunk } from '@idle/contracts';

export type ChangeFileState = {
  exists: boolean;
  content: string;
};

export type ApplyChangeSetResult = {
  changes: AppliedChange[];
};

export type AppliedChange = {
  path: string;
  operation: FileChange['operation'];
  content: string | null;
};

export class ChangeSetApplyError extends Error {
  readonly errors: ChangeSetValidationError[];

  constructor(errors: ChangeSetValidationError[]) {
    super(`Change Set validation failed: ${errors.map((error) => error.code).join(', ')}`);
    this.name = 'ChangeSetApplyError';
    this.errors = errors;
  }
}

const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/;

type SplitLinesResult = {
  lines: string[];
  newline: '\n' | '\r\n';
  trailingNewline: boolean;
};

function isValidProjectPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  if (WINDOWS_DRIVE_PREFIX.test(path)) return false;

  const segments = path.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function splitLines(content: string): SplitLinesResult {
  const newline: '\n' | '\r\n' = content.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = content.endsWith(newline);
  let lines = content.split(/\r\n|\n/);

  if (trailingNewline) lines = lines.slice(0, -1);
  if (content.length === 0) lines = [];

  return { lines, newline, trailingNewline };
}

function joinLines(lines: string[], newline: '\n' | '\r\n', trailingNewline: boolean): string {
  const content = lines.join(newline);
  return trailingNewline ? `${content}${newline}` : content;
}

function validateHunks(
  path: string,
  content: string,
  hunks: unknown,
  errors: ChangeSetValidationError[],
): void {
  if (!Array.isArray(hunks)) {
    errors.push({
      path,
      code: 'INVALID_HUNK',
      message: 'Modify changes must contain an array of hunks.',
    });
    return;
  }

  const { lines } = splitLines(content);
  let previousStart = 0;
  let previousEndExclusive = 0;
  let previousOldLineCount = 0;

  for (const hunk of hunks as unknown[]) {
    if (!isTextHunk(hunk)) {
      errors.push({
        path,
        code: 'INVALID_HUNK',
        message: 'Each hunk must contain an integer oldStart and string line arrays.',
      });
      continue;
    }

    if (hunk.oldStart <= 0 || hunk.oldStart > lines.length + 1) {
      errors.push({
        path,
        code: 'INVALID_HUNK',
        message: `Hunk oldStart ${hunk.oldStart} is outside the valid line range.`,
      });
      continue;
    }

    const sameStartAfterInsertion =
      previousStart > 0 && hunk.oldStart === previousStart && previousOldLineCount === 0;
    if (previousStart > 0 && (hunk.oldStart < previousStart || (hunk.oldStart === previousStart && !sameStartAfterInsertion))) {
      errors.push({
        path,
        code: 'INVALID_HUNK',
        message: 'Hunks must be strictly ordered by oldStart.',
      });
      continue;
    }

    if (previousStart > 0 && hunk.oldStart < previousEndExclusive) {
      errors.push({
        path,
        code: 'INVALID_HUNK',
        message: 'Hunks must not overlap.',
      });
      continue;
    }

    const startIndex = hunk.oldStart - 1;
    const endIndex = startIndex + hunk.oldLines.length;
    if (endIndex > lines.length) {
      errors.push({
        path,
        code: 'INVALID_HUNK',
        message: 'Hunk oldLines extend beyond the end of the file.',
      });
      continue;
    }

    const actualLines = lines.slice(startIndex, endIndex);
    if (!sameLines(actualLines, hunk.oldLines)) {
      errors.push({
        path,
        code: 'HUNK_MISMATCH',
        message: `Hunk context does not match ${path} at line ${hunk.oldStart}.`,
      });
    }

    previousStart = hunk.oldStart;
    previousEndExclusive = endIndex;
    previousOldLineCount = hunk.oldLines.length;
  }
}

function isTextHunk(value: unknown): value is TextHunk {
  if (typeof value !== 'object' || value === null) return false;

  const hunk = value as Record<string, unknown>;
  return (
    Number.isInteger(hunk.oldStart) &&
    Array.isArray(hunk.oldLines) &&
    Array.isArray(hunk.newLines) &&
    hunk.oldLines.every((line) => typeof line === 'string') &&
    hunk.newLines.every((line) => typeof line === 'string')
  );
}

function sameLines(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((line, index) => line === right[index]);
}

function validateChange(
  change: FileChange,
  files: ReadonlyMap<string, ChangeFileState>,
  errors: ChangeSetValidationError[],
): void {
  if (!isValidProjectPath(change.path)) {
    errors.push({
      path: typeof change.path === 'string' ? change.path : '<invalid>',
      code: 'INVALID_PATH',
      message: 'Path must be a non-empty project-relative POSIX path without traversal or backslashes.',
    });
    return;
  }

  const state = files.get(change.path);

  switch (change.operation) {
    case 'modify':
      if (!state?.exists || state.content !== change.baseContent) {
        errors.push({
          path: change.path,
          code: 'BASE_MISMATCH',
          message: 'The workspace content does not exactly match the planned base content.',
        });
        return;
      }
      validateHunks(change.path, state.content, change.hunks, errors);
      return;

    case 'create':
      if (state?.exists) {
        errors.push({
          path: change.path,
          code: 'BASE_MISMATCH',
          message: 'Create target already exists in the workspace.',
        });
      }
      if (typeof change.content !== 'string') {
        errors.push({
          path: change.path,
          code: 'MISSING_CONTENT',
          message: 'Create changes must contain string content.',
        });
      }
      return;

    case 'delete':
      if (!state?.exists || state.content !== change.baseContent) {
        errors.push({
          path: change.path,
          code: 'BASE_MISMATCH',
          message: 'The workspace content does not exactly match the planned delete base content.',
        });
      }
      return;
  }
}

export function validateChangeSet(
  changeSet: ChangeSet,
  files: ReadonlyMap<string, ChangeFileState>,
): ChangeSetValidationResult {
  const errors: ChangeSetValidationError[] = [];
  const seenPaths = new Set<string>();

  for (const change of changeSet.changes) {
    if (seenPaths.has(change.path)) {
      errors.push({
        path: change.path,
        code: 'DUPLICATE_PATH',
        message: 'A path may occur only once in a Change Set.',
      });
    } else {
      seenPaths.add(change.path);
    }

    validateChange(change, files, errors);
  }

  return { valid: errors.length === 0, errors };
}

function applyModify(change: Extract<FileChange, { operation: 'modify' }>): string {
  const { lines, newline, trailingNewline } = splitLines(change.baseContent);
  const result = [...lines];

  for (let index = change.hunks.length - 1; index >= 0; index -= 1) {
    const hunk = change.hunks[index];
    if (!hunk) continue;
    const startIndex = hunk.oldStart - 1;
    result.splice(startIndex, hunk.oldLines.length, ...hunk.newLines);
  }

  return joinLines(result, newline, trailingNewline);
}

export function applyChangeSet(
  changeSet: ChangeSet,
  files: ReadonlyMap<string, ChangeFileState>,
): ApplyChangeSetResult {
  const validation = validateChangeSet(changeSet, files);
  if (!validation.valid) throw new ChangeSetApplyError(validation.errors);

  return {
    changes: changeSet.changes.map((change): AppliedChange => {
      switch (change.operation) {
        case 'modify':
          return { path: change.path, operation: change.operation, content: applyModify(change) };
        case 'create':
          return { path: change.path, operation: change.operation, content: change.content };
        case 'delete':
          return { path: change.path, operation: change.operation, content: null };
      }
    }),
  };
}

type ChangeSetValidationResult = {
  valid: boolean;
  errors: ChangeSetValidationError[];
};
