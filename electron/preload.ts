import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type DesktopBridge } from './bridge';

const bridge: DesktopBridge = {
  holdAwake: (awake) => ipcRenderer.send(CHANNELS.holdAwake, awake),
};

contextBridge.exposeInMainWorld('desktop', bridge);
