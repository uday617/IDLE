import type { ChangeSet, ChangeSetApplyResult, ChangeSetReviewResult, FileContent, FileEntry, Project, TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
import type { ProviderSettings } from '../main/SettingsStore.js';

declare global {
  interface Window {
    idle: {
      version: string;
      settings: {
        get(): Promise<ProviderSettings>;
        set(settings: ProviderSettings): Promise<ProviderSettings>;
      };
      project: {
        openDialog(): Promise<Project | null>;
        listFiles(projectId: string, path?: string): Promise<FileEntry[] | null>;
        readFile(projectId: string, path: string): Promise<FileContent | null>;
        writeFile(projectId: string, path: string, content: string): Promise<{ ok: true } | null>;
        close(projectId: string): Promise<{ ok: true } | null>;
        gitStatus(projectId: string): Promise<{ branch: string; clean: boolean; changedFiles: string[]; stagedFiles: string[] } | null>;
        gitDiff(projectId: string): Promise<string | null>;
        terminalRun(projectId: string, command: string): Promise<{ exitCode: number; stdout: string; stderr: string } | null>;
        reviewChangeSet(projectId: string, changeSet: ChangeSet): Promise<ChangeSetReviewResult | null>;
        applyChangeSet(projectId: string, changeSet: ChangeSet): Promise<ChangeSetApplyResult | null>;
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
