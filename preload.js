const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
    resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', { width, height }),
    getMetadata: (filePath) => ipcRenderer.invoke('get-metadata', filePath),
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    savePlaylist: (trackList) => ipcRenderer.invoke('save-playlist', trackList),
    loadPlaylist: () => ipcRenderer.invoke('load-playlist'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    showContextMenu: () => ipcRenderer.send('show-context-menu'),
    readSkinFile: (filename) => ipcRenderer.invoke('read-skin-file', filename),
    onLoadSkin: (callback) => ipcRenderer.on('load-skin', (event, data) => callback(data)),
    onResetSkin: (callback) => ipcRenderer.on('reset-skin', () => callback()),
    onAddTracks: (callback) => ipcRenderer.on('add-tracks', (event, paths) => callback(paths)),
    sendAudioData: (data) => ipcRenderer.send('audio-data', data),
    onAudioData: (callback) => ipcRenderer.on('audio-data', (event, data) => callback(data)),
    onTogglePlaylist: (callback) => ipcRenderer.on('toggle-playlist', () => callback()),
    moveWindow: (deltaX, deltaY) => ipcRenderer.send('move-window', { deltaX, deltaY })
});
