import { describe, expect, it } from 'vitest';
import { TaskMemoryRecorder } from '../../src/memory/TaskMemoryRecorder.js';

function createRepository() {
  return {
    saveTaskMemory: async (taskId: string, entry: unknown) => {
      records.push({ taskId, entry });
    },
  };
}

const records: Array<{ taskId: string; entry: unknown }> = [];

describe('TaskMemoryRecorder', () => {
  it('records a bounded completed task outcome with verification status', async () => {
    records.length = 0;
    const recorder = new TaskMemoryRecorder(createRepository());

    await recorder.record({
      taskId: 'task-1',
      projectId: 'project-1',
      status: 'completed',
      prompt: 'Fix the parser',
      verification: 'passed',
      summary: 'Parser now handles empty input.',
    });

    expect(records).toEqual([
      {
        taskId: 'task-1',
        entry: {
          projectId: 'project-1',
          status: 'completed',
          prompt: 'Fix the parser',
          verification: 'passed',
          summary: 'Parser now handles empty input.',
        },
      },
    ]);
  });
});
