import type { FileEntry, Project } from '../preload.js';

declare global {
  interface Window {
    idle: {
      version: string;
      project: {
        openDialog(): Promise<Project | null>;
        listFiles(projectId: string, path?: string): Promise<FileEntry[] | null>;
        close(projectId: string): Promise<{ ok: true } | null>;
      };
    };
  }
}

export {};
