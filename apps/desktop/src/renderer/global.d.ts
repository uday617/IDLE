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
    };
  }
}

export {};
