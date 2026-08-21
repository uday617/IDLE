import { describe, expect, it } from 'vitest';
import type { AgentPlan } from '../../src/agents/AgentPlanner.js';
import { AgentChangeSetBuilder } from '../../src/agents/AgentChangeSetBuilder.js';

describe('AgentChangeSetBuilder', () => {
  it('creates a deterministic empty changeset from a plan', () => {
    const plan: AgentPlan = {
      taskId: 'task-1',
      projectId: 'project-1',
      goal: 'Add a task runner',
      steps: [{ id: 'inspect-structure', description: 'Inspect the project structure' }],
    };

    const changeSet = new AgentChangeSetBuilder().createChangeSet(plan);

    expect(changeSet).toEqual({
      id: 'changeset-task-1',
      description: 'Add a task runner',
      changes: [],
    });
  });

  it('preserves explicitly proposed file changes without applying them', () => {
    const plan: AgentPlan = {
      taskId: 'task-2',
      projectId: 'project-2',
      goal: 'Create a config file',
      steps: [],
    };
    const change = {
      operation: 'create' as const,
      path: 'config.json',
      baseContent: null,
      content: '{}',
    };

    const changeSet = new AgentChangeSetBuilder().createChangeSet(plan, [change]);

    expect(changeSet.changes).toEqual([change]);
    expect(changeSet.id).toBe('changeset-task-2');
  });
});
