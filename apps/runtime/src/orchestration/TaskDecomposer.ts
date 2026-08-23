import type { AgentSubtask, TaskId } from '@idle/contracts';

export interface TaskDecomposerOptions {
  maxAgents: number;
}

const SUBTASK_HEADER = /^SUBTASK\s+\d+\s*:\s*(.+)$/;
const PATHS_HEADER = /^PATHS\s*:\s*(.*)$/;

export class TaskDecomposer {
  private readonly maxAgents: number;

  constructor(options: TaskDecomposerOptions) {
    if (!Number.isInteger(options.maxAgents) || options.maxAgents < 1) {
      throw new Error('maxAgents must be a positive integer');
    }
    this.maxAgents = options.maxAgents;
  }

  decompose(taskId: TaskId, prompt: string): AgentSubtask[] {
    const blocks = this.parseIndependentBlocks(prompt);
    if (blocks.length < 2) {
      return [{ id: `${taskId}:subtask-1`, parentTaskId: taskId, prompt: prompt.trim() }];
    }

    return blocks.slice(0, this.maxAgents).map((block, index) => ({
      id: `${taskId}:subtask-${index + 1}`,
      parentTaskId: taskId,
      prompt: block.prompt,
      ...(block.claimedPaths.length > 0 ? { claimedPaths: block.claimedPaths } : {}),
    }));
  }

  private parseIndependentBlocks(prompt: string): Array<{ prompt: string; claimedPaths: string[] }> {
    const lines = prompt.split(/\r?\n/);
    const blocks: Array<{ prompt: string; claimedPaths: string[] }> = [];
    let current: { prompt: string; claimedPaths: string[] } | null = null;

    for (const line of lines) {
      const header = line.match(SUBTASK_HEADER);
      if (header) {
        if (current) blocks.push(current);
        const title = header[1]?.trim();
        current = title ? { prompt: title, claimedPaths: [] } : null;
        continue;
      }

      const paths = line.match(PATHS_HEADER);
      if (paths && current) {
        current.claimedPaths = (paths[1] ?? '')
          .split(',')
          .map((path) => path.trim())
          .filter(Boolean);
        continue;
      }

      if (current && line.trim()) {
        current.prompt += `\n${line.trim()}`;
      }
    }

    if (current) blocks.push(current);
    return blocks;
  }
}
