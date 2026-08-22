import type { FileChange } from '@idle/contracts';
import type { FileService } from '../../project/FileService.js';
import type { AgentTool, AgentToolContext } from './ToolRegistry.js';

export interface AgentWorkspaceProposalBuffer {
  changes: FileChange[];
  add(change: FileChange): void;
}

export function createAgentWorkspaceProposalBuffer(): AgentWorkspaceProposalBuffer {
  const changes: FileChange[] = [];
  const seen = new Set<string>();

  return {
    changes,
    add(change) {
      if (seen.has(change.path)) throw new Error(`Duplicate proposed path: ${change.path}`);
      seen.add(change.path);
      changes.push(change);
    },
  };
}

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

function stringArgument(arguments_: Record<string, unknown>, name: string): string {
  const value = arguments_[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`);
  return value;
}

export function createAgentWorkspaceTools(
  files: FileService,
  proposals: AgentWorkspaceProposalBuffer,
): AgentTool[] {
  const listFiles: AgentTool = {
    name: 'list_files',
    description: 'List files and directories in the project. Use this to inspect the repository before proposing changes.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Project-relative directory path, usually .' } },
      required: ['path'],
      additionalProperties: false,
    },
    async execute(arguments_: Record<string, unknown>, context: AgentToolContext) {
      const path = stringArgument(arguments_, 'path');
      assertSafePath(path === '.' ? 'root' : path);
      const entries = await files.list(context.projectId, path);
      return { content: JSON.stringify(entries) };
    },
  };

  const readFile: AgentTool = {
    name: 'read_file',
    description: 'Read a project-relative text file. Only read files needed to complete the task.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Project-relative file path' } },
      required: ['path'],
      additionalProperties: false,
    },
    async execute(arguments_: Record<string, unknown>, context: AgentToolContext) {
      const path = stringArgument(arguments_, 'path');
      assertSafePath(path);
      const result = await files.read(context.projectId, path);
      return { content: result.content };
    },
  };

  const createFile: AgentTool = {
    name: 'propose_create_file',
    description: 'Propose creating a new file. This never writes to disk; the proposal must be reviewed before apply.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    async execute(arguments_: Record<string, unknown>) {
      const path = stringArgument(arguments_, 'path');
      const content = arguments_.content;
      if (typeof content !== 'string') throw new Error('content must be a string');
      assertSafePath(path);
      proposals.add({ operation: 'create', path, baseContent: null, content });
      return { content: `Proposed create: ${path}` };
    },
  };

  const replaceLine: AgentTool = {
    name: 'propose_replace_line',
    description: 'Propose replacing one exact existing line in a file. This never writes to disk; the proposal must be reviewed before apply.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        oldLine: { type: 'string' },
        newLine: { type: 'string' },
      },
      required: ['path', 'oldLine', 'newLine'],
      additionalProperties: false,
    },
    async execute(arguments_: Record<string, unknown>, context: AgentToolContext) {
      const path = stringArgument(arguments_, 'path');
      const oldLine = stringArgument(arguments_, 'oldLine');
      const newLine = stringArgument(arguments_, 'newLine');
      assertSafePath(path);
      const file = await files.read(context.projectId, path);
      const lines = file.content.split(/\r?\n/);
      const index = lines.findIndex((line) => line === oldLine);
      if (index < 0) throw new Error(`Line not found in ${path}`);
      proposals.add({
        operation: 'modify',
        path,
        baseContent: file.content,
        hunks: [{ oldStart: index + 1, oldLines: [oldLine], newLines: [newLine] }],
      });
      return { content: `Proposed line replacement: ${path}:${index + 1}` };
    },
  };

  const deleteFile: AgentTool = {
    name: 'propose_delete_file',
    description: 'Propose deleting a file. This never deletes from disk; the proposal must be reviewed before apply.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
    async execute(arguments_: Record<string, unknown>, context: AgentToolContext) {
      const path = stringArgument(arguments_, 'path');
      assertSafePath(path);
      const file = await files.read(context.projectId, path);
      proposals.add({ operation: 'delete', path, baseContent: file.content });
      return { content: `Proposed delete: ${path}` };
    },
  };

  // Compatibility with agents that use the conventional root-listing tool name.
  // Keep list_files as the parameterized API while allowing root discovery
  // without requiring the model to invent a path argument.
  const listRoots: AgentTool = {
    name: 'list_roots',
    description: 'List the files and directories at the project root. Use this first when inspecting a project.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    async execute(_arguments_: Record<string, unknown>, context: AgentToolContext) {
      const entries = await files.list(context.projectId, '.');
      return { content: JSON.stringify(entries) };
    },
  };

  return [listFiles, readFile, createFile, replaceLine, deleteFile, listRoots];
}
