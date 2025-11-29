// preload.js

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



contextBridge.exposeInMainWorld('electronAPI', {

   // Window controls
   minimize: () => ipcRenderer.invoke('window:minimize'),
   maximize: () => ipcRenderer.invoke('window:maximize'),
   restore:  () => ipcRenderer.invoke('window:restore'),
   close:    () => ipcRenderer.invoke('window:close'),

   // Session + summary
   getSummary: () => ipcRenderer.invoke("get-summary"),
   endSession: (payload) => ipcRenderer.send("end-session", payload),
   finishSession: () => ipcRenderer.send("finish-session"),
   exitApp: () => ipcRenderer.send("exit-app"),

   // User session storage
   getUserSession: () => ipcRenderer.invoke("get-user-session"),
   saveUserSession: (data) => ipcRenderer.send("save-user-session", data),

   // Navigation
   loadActivity: () => ipcRenderer.invoke("load-activity"),

   // LLM + location
   ask: (prompt) => ipcRenderer.invoke("ask", prompt),
   requestIpLocation: () => ipcRenderer.invoke("location:request-ip"),
   setLocation: (location) => ipcRenderer.invoke("location:set", location),
   getLocation: () => ipcRenderer.invoke("location:get")
});

// Summary page API
contextBridge.exposeInMainWorld('sessionAPI', {
    get: () => ipcRenderer.invoke("get-summary")
});

// Companion APIs
contextBridge.exposeInMainWorld('companion', {
  startSession: () => ipcRenderer.send("start-session"),
  start: () => ipcRenderer.invoke('companion:start'),
  stop:  () => ipcRenderer.invoke('companion:stop'),
  onState:      (cb) => ipcRenderer.on('companion:state',      (_, s) => cb(s)),
  onTranscript: (cb) => ipcRenderer.on('companion:transcript', (_, t) => cb(t)),
  onSuggestion: (cb) => ipcRenderer.on('companion:suggestion', (_, s) => cb(s))
});
contextBridge.exposeInMainWorld('windowCtl', {
   minimize: () => ipcRenderer.invoke('window:minimize'),
   maximize: () => ipcRenderer.invoke('window:maximize'),
   restore:  () => ipcRenderer.invoke('window:restore'),
   close:    () => ipcRenderer.invoke('window:close')
});

