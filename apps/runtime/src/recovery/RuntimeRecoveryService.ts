import { TaskService } from '../tasks/TaskService.js';

export class RuntimeRecoveryService {
  constructor(private readonly taskService: TaskService) {}

  async resumePendingTasks(): Promise<string[]> {
    return this.taskService.resumePendingTasks();
  }

  async resumePendingTasksWith(
    resume: Parameters<TaskService['resumePendingTasks']>[0],
  ): Promise<string[]> {
    return this.taskService.resumePendingTasks(resume);
  }
}
