import type { ChangeSet, CreateChange } from '@idle/contracts';

export interface AgentProposalRequest {
  taskId: string;
  goal: string;
}

const CREATE_FILE_PATTERN = /Create file\s+["']([^"']+)["']\s+with content:\s*\n([\s\S]*?)(?=\nCreate file\s+["'][^"']+["']\s+with content:\s*\n|$)/gi;

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

export class AgentProposalEngine {
  propose(request: AgentProposalRequest): ChangeSet {
    const changes: CreateChange[] = [];
    const seenPaths = new Set<string>();

    for (const match of request.goal.matchAll(CREATE_FILE_PATTERN)) {
      const path = match[1]?.trim();
      const content = match[2]?.replace(/\s+$/, '');
      if (!path || content === undefined) continue;

      assertSafePath(path);
      if (seenPaths.has(path)) throw new Error(`Duplicate proposed path: ${path}`);
      seenPaths.add(path);

      changes.push({
        operation: 'create',
        path,
        baseContent: null,
        content,
      });
    }

    return {
      id: `proposal-${request.taskId}`,
      description: request.goal,
      changes,
    };
  }
}
