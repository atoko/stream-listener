const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('electron', {
    onPort: (callback) => ipcRenderer.on("app-port", (_event, value) => callback(value))
})