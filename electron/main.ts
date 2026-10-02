import path from 'node:path';
import { app, BrowserWindow, ipcMain, powerSaveBlocker, session, shell } from 'electron';
import { CHANNELS } from './bridge';

const DEV_SERVER_FLAG = '--dev-server=';

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const devServer = app.isPackaged
  ? undefined
  : process.argv.find((arg) => arg.startsWith(DEV_SERVER_FLAG))?.slice(DEV_SERVER_FLAG.length);

let awakeBlocker: number | null = null;

function holdAwake(awake: boolean) {
  if (awake && awakeBlocker === null) awakeBlocker = powerSaveBlocker.start('prevent-display-sleep');
  if (!awake && awakeBlocker !== null) {
    powerSaveBlocker.stop(awakeBlocker);
    awakeBlocker = null;
  }
}

function grantSystemAudio() {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (request.frame) callback({ video: request.frame, audio: 'loopback' });
    else callback({});
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  if (devServer) window.loadURL(devServer);
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  ipcMain.on(CHANNELS.holdAwake, (_event, awake: boolean) => holdAwake(awake));
  grantSystemAudio();
  createWindow();
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
