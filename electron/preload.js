// preload.js
console.log("PRELOAD LOADED");

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  send: (channel, ...args) => ipcRenderer.send(channel, ...args),

  on: (channel, listener) => {
    const wrapped = (event, ...args) => listener(event, ...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
});



contextBridge.exposeInMainWorld('windowCtl', {
   minimize: () => ipcRenderer.invoke('window:minimize'),
   maximize: () => ipcRenderer.invoke('window:maximize'),
   restore: () => ipcRenderer.invoke('window:restore'),
   close:    () => ipcRenderer.invoke('window:close'),
   getSummary: () => ipcRenderer.invoke("get-summary"),
   endSession: (payload) => ipcRenderer.send("end-session", payload),
   finishSession: () => ipcRenderer.send("finish-session"),
   exitApp: () => ipcRenderer.send("exit-app")
});


 // NEW – required for summaryRoot.html
 contextBridge.exposeInMainWorld('sessionAPI', {
    get: () => ipcRenderer.invoke("get-summary")
});


contextBridge.exposeInMainWorld('companion', {
  startSession: () => ipcRenderer.send("start-session"),
  start: () => ipcRenderer.invoke('companion:start'),
  stop:  () => ipcRenderer.invoke('companion:stop'),
  onState:      (cb) => ipcRenderer.on('companion:state',      (_, s) => cb(s)),
  onTranscript: (cb) => ipcRenderer.on('companion:transcript', (_, t) => cb(t)),
  onSuggestion: (cb) => ipcRenderer.on('companion:suggestion', (_, s) => cb(s))
});

// Expose auth/session helpers for renderer (login, skip login)
contextBridge.exposeInMainWorld("electronAPI", {
  saveUserSession: (data) => ipcRenderer.send("save-user-session", data),
  getUserSession: () => ipcRenderer.invoke("get-user-session"),
  loadActivity: () => ipcRenderer.invoke("load-activity")
});
