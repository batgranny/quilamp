const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
    resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', { width, height }),
    getMetadata: (filePath) => ipcRenderer.invoke('get-metadata', filePath),
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    savePlaylist: (trackList) => ipcRenderer.invoke('save-playlist', trackList),
    loadPlaylist: () => ipcRenderer.invoke('load-playlist')
});
