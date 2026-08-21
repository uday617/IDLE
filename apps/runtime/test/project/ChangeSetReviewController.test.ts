import { describe, expect, it } from 'vitest';
import { ProjectController } from '../../src/project/ProjectController.js';

describe('ProjectController changeset review command', () => {
  it('routes changeset.review to the changeset service', async () => {
    const changeSets = {
      review: async () => ({ id: 'review-1', valid: true, errors: [], preview: { id: 'review-1', files: [] } }),
      preview: async () => ({ id: 'preview-1', files: [] }),
      apply: async () => ({ id: 'apply-1', changedFiles: [] }),
    };
    const controller = new ProjectController({} as never, {} as never, changeSets as never);

    await expect(controller.handle({
      type: 'changeset.review',
      projectId: 'project-1',
      changeSet: { id: 'review-1', description: 'review', changes: [] },
    })).resolves.toEqual({ id: 'review-1', valid: true, errors: [], preview: { id: 'review-1', files: [] } });
  });
});
