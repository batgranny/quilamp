const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
    resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', { width, height })
});
