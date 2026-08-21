import type { TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
import type { FileContent, FileEntry, Project } from '../preload.js';

declare global {
  interface Window {
    idle: {
      version: string;
      project: {
        openDialog(): Promise<Project | null>;
        listFiles(projectId: string, path?: string): Promise<FileEntry[] | null>;
        readFile(projectId: string, path: string): Promise<FileContent | null>;
        writeFile(projectId: string, path: string, content: string): Promise<{ ok: true } | null>;
        close(projectId: string): Promise<{ ok: true } | null>;
      };
      tasks: {
        submit(request: TaskSubmitRequest): Promise<TaskSubmitResult>;
        get(taskId: string): Promise<TaskResult | null>;
        subscribe(listener: (event: TaskStatusEvent) => void): () => void;
      };
    };
  }
}

export {};
