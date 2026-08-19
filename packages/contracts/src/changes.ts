export type ChangeOperation = 'modify' | 'create' | 'delete';

export interface TextHunk {
  oldStart: number;
  oldLines: string[];
  newLines: string[];
}

export interface ModifyChange {
  operation: 'modify';
  path: string;
  baseContent: string;
  hunks: TextHunk[];
}

export interface CreateChange {
  operation: 'create';
  path: string;
  baseContent: null;
  content: string;
}

export interface DeleteChange {
  operation: 'delete';
  path: string;
  baseContent: string;
}

export type FileChange = ModifyChange | CreateChange | DeleteChange;

export interface ChangeSet {
  id: string;
  description: string;
  changes: FileChange[];
}

export type ChangeSetValidationErrorCode =
  | 'INVALID_PATH'
  | 'DUPLICATE_PATH'
  | 'BASE_MISMATCH'
  | 'MISSING_CONTENT'
  | 'INVALID_HUNK'
  | 'HUNK_MISMATCH';

export interface ChangeSetValidationError {
  path: string;
  code: ChangeSetValidationErrorCode;
  message: string;
}
