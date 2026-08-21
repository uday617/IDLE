import type { TaskId, TaskStatus, ProjectId } from './agent.js';
import type { ChangeSetReviewResult } from './changes.js';

export interface Task { id: TaskId; title: string; description: string; status: TaskStatus; }
export interface TaskSubmitRequest { taskId: TaskId; projectId: ProjectId; prompt: string; }
export interface TaskSubmitResult { taskId: TaskId; status: TaskStatus; }
export interface TaskStatusEvent { taskId: TaskId; status: TaskStatus; timestamp: string; message?: string; }
export interface TaskResult {
  taskId: TaskId;
  status: Extract<TaskStatus, 'completed' | 'failed' | 'cancelled' | 'paused'>;
  summary?: string;
  error?: string;
  changeSetId?: string;
  changeSetReview?: ChangeSetReviewResult;
}
