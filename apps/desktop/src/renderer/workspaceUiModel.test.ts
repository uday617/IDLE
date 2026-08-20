import { describe, expect, it } from 'vitest';
import {
  getWorkspaceStatus,
  getAgentPanelState,
  workspaceActions,
} from './workspaceUiModel.js';

describe('workspace UI model', () => {
  it('exposes the primary actions for an agent-first coding workspace', () => {
    expect(workspaceActions.map((action) => action.id)).toEqual([
      'open-project',
      'quick-task',
      'command-search',
    ]);
  });

  it('reports a useful status for a clean opened project', () => {
    expect(getWorkspaceStatus({ projectPath: 'C:/repo', dirty: false, agentCount: 0 })).toEqual({
      project: 'C:/repo',
      changes: '0 changes',
      agents: 'No active agents',
    });
  });

  it('summarizes active agents without hiding their state', () => {
    expect(getAgentPanelState([
      { name: 'Planner', status: 'working' },
      { name: 'Verifier', status: 'complete' },
    ])).toEqual({
      heading: 'Agents',
      summary: '1 working · 1 complete',
      agents: [
        { name: 'Planner', status: 'working' },
        { name: 'Verifier', status: 'complete' },
      ],
    });
  });
});
