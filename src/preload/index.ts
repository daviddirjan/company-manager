import { contextBridge, ipcRenderer } from 'electron';

type Wrapper = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void;
const wrapperMap = new WeakMap<(...args: unknown[]) => void, Wrapper>();

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrapper: Wrapper = (_event, ...args) => listener(...args);
      wrapperMap.set(listener, wrapper);
      ipcRenderer.on(channel, wrapper);
    },
    off: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrapper = wrapperMap.get(listener);
      if (wrapper) {
        ipcRenderer.removeListener(channel, wrapper);
        wrapperMap.delete(listener);
      }
    },
  },
});
