// ===== Preload bridge =====
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

// ===== Core electronAPI surface =====
contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  restore: () => ipcRenderer.invoke("window:restore"),
  close: () => ipcRenderer.invoke("window:close"),
  awaitMinimize: () => ipcRenderer.invoke("window:await-minimized"),
  clearHistoryByRange: (range) => ipcRenderer.invoke("activity:clear-range", range),
  getSummary: () => ipcRenderer.invoke("get-summary"),
  finishSession: (payload) => ipcRenderer.send("finish-session", payload),
  exitApp: () => ipcRenderer.send("exit-app"),
  captureScreenBelow: (region) => ipcRenderer.invoke("screenread:capture-below", region),
  getScreenReadRegion: () => ipcRenderer.invoke("screenread:get-region"),
  saveScreenReadRegion: (region) => ipcRenderer.invoke("screenread:save-region", region),
  launchApp: (cmd) => ipcRenderer.invoke("screenread:launch-app", cmd),
  openScreenOverlay: (region) => ipcRenderer.invoke("screenread:open-overlay", region),
  ocrImage: (base64) => ipcRenderer.invoke("ocr:image", base64),
  ocrValidate: (base64) => ipcRenderer.invoke("ocr:validate", base64),
  onTriggerFinishSession: (cb) => {
    if (typeof cb !== "function") return () => {};
    const listener = (_event, ...args) => cb(...args);
    ipcRenderer.on("trigger:end-session", listener);
    return () => ipcRenderer.removeListener("trigger:end-session", listener);
  },
  getUserSession: () => ipcRenderer.invoke("get-user-session"),
  saveUserSession: (data) => ipcRenderer.invoke("save-user-session", data),
  loadActivity: () => ipcRenderer.invoke("load-activity"),
  ask: (prompt) => ipcRenderer.invoke("ask", prompt),
  chatAsk: (prompt) => ipcRenderer.invoke("chat:ask", prompt),
  requestIpLocation: () => ipcRenderer.invoke("location:request-ip"),
  setLocation: (location) => ipcRenderer.invoke("location:set", location),
  getLocation: () => ipcRenderer.invoke("location:get")
});

// ===== Companion APIs =====
contextBridge.exposeInMainWorld("companion", {
  startSession: () => ipcRenderer.send("start-session"),
  start: () => ipcRenderer.invoke("companion:start"),
  stop: () => ipcRenderer.invoke("companion:stop"),
  onState: (cb) => ipcRenderer.on("companion:state", (_, s) => cb(s)),
  onTranscript: (cb) => ipcRenderer.on("companion:transcript", (_, t) => cb(t)),
  onSuggestion: (cb) => ipcRenderer.on("companion:suggestion", (_, s) => cb(s))
});

// ===== STT bridge =====
contextBridge.exposeInMainWorld("stt", {
  transcribe: (audioBuffer) => ipcRenderer.invoke("stt:transcribe", audioBuffer)
});

// ===== Window controls =====
contextBridge.exposeInMainWorld("windowCtl", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  restore: () => ipcRenderer.invoke("window:restore"),
  close: () => ipcRenderer.invoke("window:close")
});

// ===== License helpers =====
contextBridge.exposeInMainWorld("licenseAPI", {
  activate: (key) => ipcRenderer.invoke("license:activate", key),
  check: () => ipcRenderer.invoke("license:check"),
  startTrial: () => ipcRenderer.invoke("license:startTrial"),
  trialStatus: () => ipcRenderer.invoke("license:trialStatus")
});

contextBridge.exposeInMainWorld("isPackaged", global.IS_PACKAGED);

// ===== Overlay helpers =====
contextBridge.exposeInMainWorld("overlayAPI", {
  confirm: (region) => ipcRenderer.send("screenread:overlay-confirm", region),
  cancel: () => ipcRenderer.send("screenread:overlay-cancel")
});

// ===== Navigation helpers =====
contextBridge.exposeInMainWorld("nav", {
  loadLocalFile: (file) => ipcRenderer.invoke("nav:loadLocalFile", file)
});
