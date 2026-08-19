import { contextBridge, ipcRenderer } from 'electron';

export interface Project {
  id: string;
  path: string;
}

export interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

contextBridge.exposeInMainWorld('idle', {
  version: '0.1.0',
  project: {
    openDialog: (): Promise<Project | null> => ipcRenderer.invoke('project:open-dialog'),
    listFiles: (projectId: string, path = '.'): Promise<FileEntry[] | null> =>
      ipcRenderer.invoke('project:files', projectId, path),
    close: (projectId: string): Promise<{ ok: true } | null> =>
      ipcRenderer.invoke('project:close', projectId),
  },
});
