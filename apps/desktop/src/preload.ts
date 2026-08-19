import { contextBridge, ipcRenderer } from 'electron';

export interface Project {
  id: string;
  path: string;
}

contextBridge.exposeInMainWorld('idle', {
  version: '0.1.0',
  project: {
    openDialog: (): Promise<Project | null> => ipcRenderer.invoke('project:open-dialog'),
    close: (projectId: string): Promise<{ ok: true } | null> =>
      ipcRenderer.invoke('project:close', projectId),
  },
});
