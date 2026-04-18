const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Tray = electron.Tray;
const Menu = electron.Menu;
const nativeImage = electron.nativeImage;
const ipcMain = electron.ipcMain;
const ElectronNotification = electron.Notification;
const shell = electron.shell;
const path = require('path');
const { fork } = require('child_process');

const dirname = path.dirname(__filename);

// App config
const APP_NAME = 'Dar Alamarifa';
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: any = null;
let tray: any = null;
let inactivityTimer: any;
let serverProcess: any = null;

// Start backend server in production
function startBackend() {
  if (!isDev) {
    const serverPath = path.join(dirname, '../dist/server.js');
    console.log('Starting backend server at:', serverPath);
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, NODE_ENV: 'production' }
    });

    serverProcess.on('error', (err: any) => {
      console.error('Failed to start server process:', err);
    });

    serverProcess.on('exit', (code: number) => {
      console.log(`Server process exited with code ${code}`);
    });
  }
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_NAME,
    icon: path.join(dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // Enable sandbox for security
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#072849',
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, we wait for the server to start and load it
    mainWindow.loadURL('http://localhost:3000');
    
    // Fallback if server takes too long
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:3000');
      }, 1000);
    });
  }

  // SECURITY: Prevent navigation to external URLs within the app window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url); // open in system browser instead
    }
  });

  // SECURITY: Prevent new window creation (popups)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // SECURITY: Disable DevTools in production
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup inactivity timer
  resetInactivityTimer();
}

// Auto-lock screen after 30 minutes of inactivity
function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (mainWindow) {
      mainWindow.webContents.send('force-lock');
    }
  }, 30 * 60 * 1000);
}

// System tray
function createTray() {
  const iconPath = path.join(dirname, '../public/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Dar Alamarifa', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      } 
    },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      if (serverProcess) serverProcess.kill();
      app.releaseSingleInstanceLock();
      app.quit();
    }}
  ]);
  
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(contextMenu);
}

// app.setLoginItemSettings({ openAtLogin: true });

// IPC Handlers
ipcMain.handle('notify', (event, { title, body }) => {
  new ElectronNotification({ title, body }).show();
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

// Reset timer on user activity reported from renderer
ipcMain.on('user-activity', () => {
  resetInactivityTimer();
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep in tray
  }
});
