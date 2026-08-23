import type { MemoryRepository } from './MemoryRepository.js';

export class TaskMemory<T = unknown> {
  constructor(
    private readonly taskId: string,
    private readonly repository: MemoryRepository,
  ) {
    if (!taskId) throw new Error('taskId is required');
  }

  async save(entry: T): Promise<void> {
    await this.repository.saveTaskMemory(this.taskId, entry);
  }

  async list(): Promise<T[]> {
    return this.repository.listTaskMemory<T>(this.taskId);
  }
}
