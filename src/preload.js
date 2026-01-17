const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alarmApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (s) => ipcRenderer.invoke('settings:update', s),
  getState: () => ipcRenderer.invoke('timer:getState'),

  start: () => ipcRenderer.invoke('timer:start'),
  pause: () => ipcRenderer.invoke('timer:pause'),
  reset: () => ipcRenderer.invoke('timer:reset'),
  skipToBreak: () => ipcRenderer.invoke('timer:skipToBreak'),
  skipToWork: () => ipcRenderer.invoke('timer:skipToWork'),

  onTick: (cb) => ipcRenderer.on('timer:tick', (_e, payload) => cb(payload)),
  onPhase: (cb) => ipcRenderer.on('timer:phase', (_e, payload) => cb(payload)),
  onRunning: (cb) => ipcRenderer.on('timer:running', (_e, payload) => cb(payload)),
  onSettingsUpdated: (cb) => ipcRenderer.on('settings:updated', (_e, payload) => cb(payload)),
});

