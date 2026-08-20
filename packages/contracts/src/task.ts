import type { TaskId } from './agent.js';

export interface Task {
  id: TaskId;
  title: string;
  description: string;
  status: 'queued' | 'planning' | 'running' | 'verifying' | 'completed' | 'failed' | 'cancelled' | 'paused';
}
