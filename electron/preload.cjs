"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * SECURITY: Minimal API surface exposed to the renderer process.
 * All IPC calls must be validated.
 */
const ALLOWED_CHANNELS = ['notify', 'get-version', 'open-external'];
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    notify: (title, body) => {
        if (typeof title !== 'string' || typeof body !== 'string')
            return;
        return electron_1.ipcRenderer.invoke('notify', { title, body });
    },
    isElectron: true,
    getVersion: () => electron_1.ipcRenderer.invoke('get-version'),
    openExternal: (url) => {
        if (typeof url !== 'string' || !url.startsWith('http'))
            return;
        return electron_1.ipcRenderer.invoke('open-external', url);
    },
    // Report activity to reset auto-lock timer
    reportActivity: () => electron_1.ipcRenderer.send('user-activity'),
    // Listen for force-lock event
    onForceLock: (callback) => {
        electron_1.ipcRenderer.on('force-lock', () => callback());
    }
});
