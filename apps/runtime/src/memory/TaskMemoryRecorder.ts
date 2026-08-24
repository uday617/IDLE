import type { MemoryRepository } from './MemoryRepository.js';

const MAX_TEXT_LENGTH = 2_000;

export interface TaskOutcome {
  taskId: string;
  projectId: string;
  status: 'completed' | 'failed';
  prompt?: string;
  verification?: 'passed' | 'failed' | 'not-run';
  summary?: string;
}

export class TaskMemoryRecorder {
  constructor(private readonly repository: Pick<MemoryRepository, 'saveTaskMemory'>) {}

  async record(outcome: TaskOutcome): Promise<void> {
    const entry = {
      projectId: outcome.projectId,
      status: outcome.status,
      ...(outcome.prompt !== undefined ? { prompt: this.bound(outcome.prompt) } : {}),
      ...(outcome.verification !== undefined ? { verification: outcome.verification } : {}),
      ...(outcome.summary !== undefined ? { summary: this.bound(outcome.summary) } : {}),
    };

    try {
      await this.repository.saveTaskMemory(outcome.taskId, entry);
    } catch {
      // Memory is an auxiliary capability and must never fail the task path.
    }
  }

  private bound(value: string): string {
    return value.length <= MAX_TEXT_LENGTH ? value : `${value.slice(0, MAX_TEXT_LENGTH)}…`;
  }
}
