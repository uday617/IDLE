import { describe, expect, it, vi } from 'vitest';
import type { FileService } from '../../../src/project/FileService.js';
import { createAgentWorkspaceProposalBuffer, createAgentWorkspaceTools } from '../../../src/agents/tools/AgentWorkspaceTools.js';

const context = { projectId: 'project-1', taskId: 'task-1' };

describe('AgentWorkspaceTools', () => {
  it('reads project files without writing', async () => {
    const files = {
      read: vi.fn().mockResolvedValue({ path: 'src/index.ts', content: 'export const value = 1;' }),
      list: vi.fn().mockResolvedValue([{ name: 'src', path: 'src', kind: 'directory' }]),
    } as unknown as FileService;
    const proposals = createAgentWorkspaceProposalBuffer();
    const [listFiles, readFile] = createAgentWorkspaceTools(files, proposals);

    await expect(listFiles.execute({ path: '.' }, context)).resolves.toEqual({
      content: JSON.stringify([{ name: 'src', path: 'src', kind: 'directory' }]),
    });
    await expect(readFile.execute({ path: 'src/index.ts' }, context)).resolves.toEqual({
      content: 'export const value = 1;',
    });
    expect(proposals.changes).toHaveLength(0);
  });

  it('records a replace-line proposal but does not mutate files', async () => {
    const files = {
      read: vi.fn().mockResolvedValue({ path: 'src/index.ts', content: 'export const value = 1;\n' }),
    } as unknown as FileService;
    const proposals = createAgentWorkspaceProposalBuffer();
    const [, , , replaceLine] = createAgentWorkspaceTools(files, proposals);

    await expect(replaceLine.execute({
      path: 'src/index.ts',
      oldLine: 'export const value = 1;',
      newLine: 'export const value = 2;',
    }, context)).resolves.toEqual({ content: 'Proposed line replacement: src/index.ts:1' });

    expect(proposals.changes).toEqual([{
      operation: 'modify',
      path: 'src/index.ts',
      baseContent: 'export const value = 1;\n',
      hunks: [{ oldStart: 1, oldLines: ['export const value = 1;'], newLines: ['export const value = 2;'] }],
    }]);
  });

  it('rejects unsafe proposal paths', async () => {
    const files = {} as FileService;
    const proposals = createAgentWorkspaceProposalBuffer();
    const [, , createFile] = createAgentWorkspaceTools(files, proposals);

    await expect(createFile.execute({ path: '../outside.ts', content: 'bad' }, context)).rejects.toThrow(
      'Unsafe file path: ../outside.ts',
    );
    expect(proposals.changes).toHaveLength(0);
  });
});
