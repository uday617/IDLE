import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChangeSet } from '@idle/contracts';
import { ChangeSetService } from './ChangeSetService.js';
import { FileService } from './FileService.js';
import { ProjectService } from './ProjectService.js';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createFixture(content = 'before\n') {
  const root = await mkdtemp(join(tmpdir(), 'idle-changeset-verify-'));
  temporaryPaths.push(root);
  await writeFile(join(root, 'example.txt'), content, 'utf8');
  const projects = new ProjectService();
  const project = await projects.open(root);
  return { root, projects, project };
}

function modifyChange(baseContent: string, newLines: string[]): ChangeSet {
  return {
    id: 'changeset-verify-1',
    description: 'verify apply',
    changes: [{
      operation: 'modify',
      path: 'example.txt',
      baseContent,
      hunks: [{ oldStart: 1, oldLines: baseContent.trimEnd().split('\n'), newLines }],
    }],
  };
}

describe('ChangeSetService apply verification', () => {
  it('verifies every applied file against the planned result', async () => {
    const { root, projects, project } = await createFixture();
    const files = new FileService(projects);
    const service = new ChangeSetService(projects, files);

    const result = await service.apply(project.id, modifyChange('before\n', ['after']));

    expect(result.verifiedFiles).toEqual(['example.txt']);
    expect(await readFile(join(root, 'example.txt'), 'utf8')).toBe('after\n');
  });

  it('returns a structured verification failure when the applied state differs', async () => {
    const { projects, project } = await createFixture();
    const base = new FileService(projects);
    const files = new (class extends FileService {
      override async applyBatch(projectId: string, operations: Array<{ path: string; content: string | null }>): Promise<void> {
        await base.applyBatch(projectId, operations);
        await base.write(projectId, 'example.txt', 'unexpected\n');
      }
    })(projects);
    const service = new ChangeSetService(projects, files);

    await expect(service.apply(project.id, modifyChange('before\n', ['after']))).rejects.toMatchObject({
      name: 'ChangeSetVerificationError',
      errors: [{ path: 'example.txt', code: 'VERIFY_MISMATCH' }],
    });
  });
});
