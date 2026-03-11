const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Force application name for macOS menu bar when running unpackaged
if (process.platform === 'darwin') {
    app.setName('Quinamp');
}

const isDev = !app.isPackaged;

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 413,
        minWidth: 413,
        maxWidth: 413,
        height: 696,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        frame: false,
        transparent: true,
        resizable: true, // OS window resizable vertically
        maximizable: false
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }
}

ipcMain.handle('resize-window', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const bounds = win.getBounds();
        win.setBounds({
            x: bounds.x,
            y: bounds.y,
            width: width,
            height: height
        });
    }
});

ipcMain.handle('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
});

ipcMain.handle('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] },
            { name: 'Winamp Skins', extensions: ['wsz', 'zip'] }
        ]
    });

    if (result.canceled) {
        return null;
    } else {
        return result.filePaths;
    }
});

ipcMain.handle('get-metadata', async (event, filePath) => {
    try {
        const mm = await import('music-metadata');
        const metadata = await mm.parseFile(filePath, { duration: true });
        return {
            title: metadata.common.title || null,
            artist: metadata.common.artist || null,
            duration: metadata.format.duration || null
        };
    } catch (err) {
        console.error("Failed to read metadata:", err);
        return null;
    }
});
