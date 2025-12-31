// ===== Region tool preload bridge =====
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("regionToolAPI", {
  onInit(callback) {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("region-tool:init", handler);
    return () => ipcRenderer.removeListener("region-tool:init", handler);
  },
  confirm(region) {
    ipcRenderer.send("region-tool:confirm", region);
  },
  cancel() {
    ipcRenderer.send("region-tool:cancel");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  ipcRenderer.send("region-tool:ready");
});
