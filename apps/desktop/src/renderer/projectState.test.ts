import { describe, expect, it } from 'vitest';
import {
  beginProjectOpen,
  completeProjectOpen,
  failProjectOpen,
  initialProjectWorkspaceState,
} from './projectState.js';

describe('project workspace state', () => {
  it('enters opening state without retaining a stale project', () => {
    expect(beginProjectOpen()).toEqual({ project: null, opening: true, error: null });
  });

  it('stores the selected project when opening completes', () => {
    const project = { id: 'project-1', path: 'C:/workspace/app' };
    expect(completeProjectOpen(beginProjectOpen(), project)).toEqual({
      project,
      opening: false,
      error: null,
    });
  });

  it('keeps the existing project when the user cancels', () => {
    const project = { id: 'project-1', path: 'C:/workspace/app' };
    const state = completeProjectOpen(initialProjectWorkspaceState, project);
    expect(completeProjectOpen({ ...state, opening: true }, null)).toEqual(state);
  });

  it('surfaces a runtime error and stops the opening state', () => {
    expect(failProjectOpen(beginProjectOpen(), 'Project path is not a directory')).toEqual({
      project: null,
      opening: false,
      error: 'Project path is not a directory',
    });
  });
});
