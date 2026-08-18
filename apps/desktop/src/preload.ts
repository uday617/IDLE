import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('idle', {
  version: '0.1.0',
});
