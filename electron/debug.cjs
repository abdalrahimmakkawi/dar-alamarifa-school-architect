console.log('Starting debug...');
try {
  const electron = require('electron');
  console.log('Electron loaded:', typeof electron);
  console.log('Electron keys:', Object.keys(electron));
  console.log('app:', typeof electron.app);
  console.log('BrowserWindow:', typeof electron.BrowserWindow);
} catch (error) {
  console.error('Error loading electron:', error);
}
