/*
  (c) 2025 iMSK Consultants LLC - Haloryn AI
  All Rights Reserved.

*/

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveUserSession: (data) =>
    ipcRenderer.send("save-user-session", data),

  getUserSession: () =>
    ipcRenderer.invoke("get-user-session"),

  loadActivity: () =>
    ipcRenderer.invoke("load-activity")
});
