import type { ChangeSet, CreateChange, FileChange, ModifyChange } from '@idle/contracts';

export interface AgentProposalFile {
  path: string;
  content: string;
}

export interface AgentProposalRequest {
  taskId: string;
  goal: string;
  files?: readonly AgentProposalFile[];
}

const CREATE_FILE_PATTERN = /Create file\s+["']([^"']+)["']\s+with content:\s*\n([\s\S]*?)(?=\nCreate file\s+["'][^"']+["']\s+with content:\s*\n|\nReplace line\s+["'][^"']+["']\s+with\s+["'][^"']+["']\s+in file\s+["'][^"']+["']|$)/gi;
const REPLACE_LINE_PATTERN = /Replace line\s+["']([^"']*)["']\s+with\s+["']([^"']*)["']\s+in file\s+["']([^"']+)["']/gi;

function assertSafePath(path: string): void {
  const normalized = path.replaceAll('\\', '/');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new Error(`Unsafe file path: ${path}`);
  }
}

function findFile(files: readonly AgentProposalFile[], path: string): AgentProposalFile {
  const file = files.find((entry) => entry.path === path);
  if (!file) throw new Error(`Inspected file not found: ${path}`);
  return file;
}

function createModifyChange(file: AgentProposalFile, oldLine: string, newLine: string): ModifyChange {
  const lines = file.content.split(/\r?\n/);
  const index = lines.findIndex((line) => line === oldLine);
  if (index < 0) throw new Error(`Line not found in ${file.path}: ${oldLine}`);

  return {
    operation: 'modify',
    path: file.path,
    baseContent: file.content,
    hunks: [
      {
        oldStart: index + 1,
        oldLines: [oldLine],
        newLines: [newLine],
      },
    ],
  };
}

export function extractReferencedFilePaths(goal: string): string[] {
  const paths = new Set<string>();
  for (const match of goal.matchAll(REPLACE_LINE_PATTERN)) {
    const path = match[3]?.trim();
    if (!path) continue;
    assertSafePath(path);
    paths.add(path);
  }
  return [...paths];
}

export class AgentProposalEngine {
  propose(request: AgentProposalRequest): ChangeSet {
    const changes: FileChange[] = [];
    const seenPaths = new Set<string>();

    for (const match of request.goal.matchAll(CREATE_FILE_PATTERN)) {
      const path = match[1]?.trim();
      const content = match[2]?.replace(/\s+$/, '');
      if (!path || content === undefined) continue;

      assertSafePath(path);
      if (seenPaths.has(path)) throw new Error(`Duplicate proposed path: ${path}`);
      seenPaths.add(path);

      const change: CreateChange = {
        operation: 'create',
        path,
        baseContent: null,
        content,
      };
      changes.push(change);
    }

    for (const match of request.goal.matchAll(REPLACE_LINE_PATTERN)) {
      const oldLine = match[1];
      const newLine = match[2];
      const path = match[3]?.trim();
      if (oldLine === undefined || newLine === undefined || !path) continue;

      assertSafePath(path);
      if (seenPaths.has(path)) throw new Error(`Duplicate proposed path: ${path}`);
      seenPaths.add(path);

      const file = findFile(request.files ?? [], path);
      changes.push(createModifyChange(file, oldLine, newLine));
    }

    return {
      id: `proposal-${request.taskId}`,
      description: request.goal,
      changes,
    };
  }
}
