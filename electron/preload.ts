import { contextBridge, ipcRenderer } from 'electron';

/**
 * SECURITY: Minimal API surface exposed to the renderer process.
 * All IPC calls must be validated.
 */

const ALLOWED_CHANNELS = ['notify', 'get-version', 'open-external'];

contextBridge.exposeInMainWorld('electronAPI', {
  notify: (title: string, body: string) => {
    if (typeof title !== 'string' || typeof body !== 'string') return;
    return ipcRenderer.invoke('notify', { title, body });
  },
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('get-version'),
  openExternal: (url: string) => {
    if (typeof url !== 'string' || !url.startsWith('http')) return;
    return ipcRenderer.invoke('open-external', url);
  },
  // Report activity to reset auto-lock timer
  reportActivity: () => ipcRenderer.send('user-activity'),
  // Listen for force-lock event
  onForceLock: (callback: () => void) => {
    ipcRenderer.on('force-lock', () => callback());
  }
});
