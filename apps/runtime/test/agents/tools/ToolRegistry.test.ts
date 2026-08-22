import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../../../src/agents/tools/ToolRegistry.js';

describe('ToolRegistry', () => {
  it('executes only registered tools with the task context', async () => {
    const execute = vi.fn(async () => ({ content: 'safe result' }));
    const registry = new ToolRegistry();
    registry.register({
      name: 'read_file',
      description: 'Read a project file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      execute,
    });

    await expect(registry.execute(
      { id: 'call-1', name: 'read_file', arguments: { path: 'src/index.ts' } },
      { projectId: 'project-1', taskId: 'task-1' },
    )).resolves.toEqual({ content: 'safe result' });
    expect(execute).toHaveBeenCalledWith(
      { path: 'src/index.ts' },
      { projectId: 'project-1', taskId: 'task-1' },
    );
  });

  it('rejects unknown tools without a fallback execution path', async () => {
    const registry = new ToolRegistry();

    await expect(registry.execute(
      { id: 'call-2', name: 'delete_everything', arguments: {} },
      { projectId: 'project-1', taskId: 'task-1' },
    )).rejects.toThrow('Unknown tool: delete_everything');
  });

  it('rejects null and array arguments before executing a tool', async () => {
    const execute = vi.fn(async () => ({ content: 'should not run' }));
    const registry = new ToolRegistry();
    registry.register({
      name: 'read_file',
      description: 'Read a project file',
      parameters: { type: 'object' },
      execute,
    });

    await expect(registry.execute(
      { id: 'call-3', name: 'read_file', arguments: null as never },
      { projectId: 'project-1', taskId: 'task-1' },
    )).rejects.toThrow('Invalid arguments for tool: read_file');
    await expect(registry.execute(
      { id: 'call-4', name: 'read_file', arguments: [] as never },
      { projectId: 'project-1', taskId: 'task-1' },
    )).rejects.toThrow('Invalid arguments for tool: read_file');
    expect(execute).not.toHaveBeenCalled();
  });
});
