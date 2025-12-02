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
     clearHistoryByRange: (range) => ipcRenderer.invoke("activity:clear-range", range),
   // Session + summary
   getSummary: () => ipcRenderer.invoke("get-summary"),
   finishSession: (payload) => ipcRenderer.send("finish-session", payload),
   exitApp: () => ipcRenderer.send("exit-app"),

   // User session storage
   getUserSession: () => ipcRenderer.invoke("get-user-session"),
   saveUserSession: (data) => ipcRenderer.send("save-user-session", data),

   // Navigation
   loadActivity: () => ipcRenderer.invoke("load-activity"),

   // LLM + location
// LLM + location
ask: (prompt) => ipcRenderer.invoke("ask", prompt),
chatAsk: (prompt) => ipcRenderer.invoke("chat:ask", prompt),
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
contextBridge.exposeInMainWorld("licenseAPI", {
    activate: (key) => ipcRenderer.invoke("license:activate", key),
    check: () => ipcRenderer.invoke("license:check"),
    startTrial: () => ipcRenderer.invoke("license:startTrial"),
    trialStatus: () => ipcRenderer.invoke("license:trialStatus")
});
contextBridge.exposeInMainWorld("isPackaged", global.IS_PACKAGED);

contextBridge.exposeInMainWorld("nav", {
    loadLocalFile: (file) => ipcRenderer.invoke("nav:loadLocalFile", file)
});
