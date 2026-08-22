import { contextBridge, ipcRenderer } from 'electron';
import type { ChangeSet, ChangeSetApplyResult, ChangeSetReviewResult, TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
export interface Project { id: string; path: string; }
export interface FileEntry { name: string; path: string; kind: 'file' | 'directory'; }
export interface FileContent { path: string; content: string; }
contextBridge.exposeInMainWorld('idle', {
  version: '0.1.0',
  project: {
    openDialog: (): Promise<Project | null> => ipcRenderer.invoke('project:open-dialog'),
    listFiles: (projectId: string, path = '.'): Promise<FileEntry[] | null> => ipcRenderer.invoke('project:files', projectId, path),
    readFile: (projectId: string, path: string): Promise<FileContent | null> => ipcRenderer.invoke('project:file-read', projectId, path),
    writeFile: (projectId: string, path: string, content: string): Promise<{ ok: true } | null> => ipcRenderer.invoke('project:file-write', projectId, path, content),
    close: (projectId: string): Promise<{ ok: true } | null> => ipcRenderer.invoke('project:close', projectId),
    reviewChangeSet: (projectId: string, changeSet: ChangeSet): Promise<ChangeSetReviewResult | null> => ipcRenderer.invoke('changeset:review', projectId, changeSet),
    applyChangeSet: (projectId: string, changeSet: ChangeSet): Promise<ChangeSetApplyResult | null> => ipcRenderer.invoke('changeset:apply', projectId, changeSet),
  },
  tasks: {
    submit: (request: TaskSubmitRequest): Promise<TaskSubmitResult> => ipcRenderer.invoke('task:submit', request),
    get: (taskId: string): Promise<TaskResult | null> => ipcRenderer.invoke('task:get', taskId),
    subscribe: (listener: (event: TaskStatusEvent) => void): (() => void) => { const handler = (_event: Electron.IpcRendererEvent, payload: TaskStatusEvent) => listener(payload); ipcRenderer.on('task:status', handler); return () => ipcRenderer.removeListener('task:status', handler); },
  },
});
