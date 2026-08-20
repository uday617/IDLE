import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectController } from '../../src/project/ProjectController.js';
import { ProjectService } from '../../src/project/ProjectService.js';

function expectProject(value: Awaited<ReturnType<ProjectController['handle']>>) {
  expect(value).toMatchObject({ id: expect.any(String), path: expect.any(String) });
  if (!value || !('id' in value) || !('path' in value)) {
    throw new Error('Expected a project result');
  }
  return value;
}

describe('ProjectController', () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it('opens and retrieves a project through commands', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-controller-'));
    temporaryPaths.push(root);

    const controller = new ProjectController(new ProjectService());
    const project = expectProject(await controller.handle({ type: 'project.open', path: root }));

    expect(project.path).toBe(root);
    expect(await controller.handle({ type: 'project.get', projectId: project.id })).toEqual(project);
  });

  it('closes a project through a command', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-controller-'));
    temporaryPaths.push(root);

    const controller = new ProjectController(new ProjectService());
    const project = expectProject(await controller.handle({ type: 'project.open', path: root }));

    expect(await controller.handle({ type: 'project.close', projectId: project.id })).toEqual({ ok: true });
    expect(await controller.handle({ type: 'project.get', projectId: project.id })).toBeNull();
  });
});
