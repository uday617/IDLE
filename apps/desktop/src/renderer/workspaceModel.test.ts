import { describe, expect, it } from 'vitest';
import { getWorkspacePanelTitle, workspacePanels } from './workspaceModel.js';

describe('workspace model', () => {
  it('defines the initial IDE panels', () => {
    expect(workspacePanels.map((panel) => panel.id)).toEqual([
      'explorer',
      'editor',
      'agents',
    ]);
  });

  it('returns the title for a known panel', () => {
    expect(getWorkspacePanelTitle('explorer')).toBe('Project');
    expect(getWorkspacePanelTitle('editor')).toBe('Editor');
    expect(getWorkspacePanelTitle('agents')).toBe('Agents');
  });
});
