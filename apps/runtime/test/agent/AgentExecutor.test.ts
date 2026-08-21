import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentExecutor } from '../../src/agents/AgentExecutor.js';
import { FileService } from '../../src/project/FileService.js';
import { ProjectService } from '../../src/project/ProjectService.js';

describe('AgentExecutor', () => {
  it('inspects a project without modifying files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-agent-'));
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo-project' }));
    await writeFile(join(root, 'README.md'), '# Demo');

    const projects = new ProjectService();
    const files = new FileService(projects);
    const project = await projects.open(root);
    const executor = new AgentExecutor(projects, files);

    const result = await executor.execute({
      id: 'task-1',
      projectId: project.id,
      prompt: 'Inspect this project',
    });

    expect(result).toMatchObject({
      taskId: 'task-1',
      projectId: project.id,
      prompt: 'Inspect this project',
      packageName: 'demo-project',
    });
    expect(result.topLevelEntries).toEqual([
      { name: 'src', kind: 'directory' },
      { name: 'package.json', kind: 'file' },
      { name: 'README.md', kind: 'file' },
    ]);
  });

  it('rejects a task without a project id', async () => {
    const projects = new ProjectService();
    const files = new FileService(projects);
    const executor = new AgentExecutor(projects, files);

    await expect(executor.execute({ id: 'task-2' })).rejects.toThrow('Agent task requires a project id');
  });
});
