import { describe, expect, it } from 'vitest';
import { AgentPlanner } from '../../src/agents/AgentPlanner.js';

describe('AgentPlanner', () => {
  it('creates a deterministic inspection plan from executor context', () => {
    const planner = new AgentPlanner();

    const plan = planner.createPlan({
      taskId: 'task-1',
      projectId: 'project-1',
      prompt: 'Inspect this project',
      projectPath: '/workspace/demo',
      topLevelEntries: [
        { name: 'src', kind: 'directory' },
        { name: 'package.json', kind: 'file' },
      ],
      packageName: 'demo-project',
    });

    expect(plan).toEqual({
      taskId: 'task-1',
      projectId: 'project-1',
      goal: 'Inspect this project',
      steps: [
        { id: 'inspect-structure', description: 'Inspect the project structure' },
        { id: 'inspect-package', description: 'Inspect package metadata' },
      ],
    });
  });

  it('omits package inspection when package metadata is unavailable', () => {
    const planner = new AgentPlanner();

    const plan = planner.createPlan({
      taskId: 'task-2',
      projectId: 'project-2',
      prompt: 'Inspect files',
      projectPath: '/workspace/demo',
      topLevelEntries: [{ name: 'src', kind: 'directory' }],
    });

    expect(plan.steps).toEqual([
      { id: 'inspect-structure', description: 'Inspect the project structure' },
    ]);
  });
});
