import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { RuntimeClient } from './main/runtimeClient.js';

let runtimeClient: RuntimeClient | null = null;

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app.whenReady().then(() => {
  runtimeClient = new RuntimeClient(join(app.getAppPath(), '../runtime/dist/main.js'));
  runtimeClient.start();

  ipcMain.handle('project:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return runtimeClient?.request({ type: 'project.open', path: result.filePaths[0] }) ?? null;
  });

  ipcMain.handle('project:files', async (_event, projectId: string, path: string) => {
    return runtimeClient?.request({ type: 'file.list', projectId, path }) ?? null;
  });

  ipcMain.handle('project:close', async (_event, projectId: string) => {
    return runtimeClient?.request({ type: 'project.close', projectId }) ?? null;
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  runtimeClient?.stop();
  if (process.platform !== 'darwin') app.quit();
});
