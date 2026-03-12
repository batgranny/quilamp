const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Force application name for macOS menu bar when running unpackaged
if (process.platform === 'darwin') {
    app.setName('Quinamp');
}

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

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

    // Set up Application Menu (essential for macOS)
    const template = [
        {
            label: app.name,
            submenu: [
                { label: 'About Quinamp', click: createAboutWindow },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'File',
            submenu: [
                { role: 'close' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        await shell.openExternal('https://github.com/chrisconnolly/quinamp');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createAboutWindow() {
    const aboutWindow = new BrowserWindow({
        width: 350,
        height: 380,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'About Quinamp',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        frame: true, // Standard window for About
        backgroundColor: '#2c2c2c'
    });

    // Remove menu bar for About window on other platforms if needed
    aboutWindow.setMenu(null);

    aboutWindow.loadFile('about.html');
}

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

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

ipcMain.handle('save-playlist', async (event, trackList) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Playlist',
        defaultPath: 'playlist.m3u',
        filters: [{ name: 'M3U Playlist', extensions: ['m3u'] }]
    });

    if (canceled || !filePath) return false;

    try {
        const m3uContent = '#EXTM3U\n' + trackList.join('\n');
        await fs.promises.writeFile(filePath, m3uContent, 'utf-8');
        return true;
    } catch (err) {
        console.error('Failed to save playlist:', err);
        return false;
    }
});

ipcMain.handle('load-playlist', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Load Playlist',
        filters: [{ name: 'M3U Playlist', extensions: ['m3u'] }],
        properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) return null;

    try {
        const content = await fs.promises.readFile(filePaths[0], 'utf-8');
        const lines = content.split('\n').map(line => line.trim());
        const tracks = lines.filter(line => line.length > 0 && !line.startsWith('#'));
        return tracks;
    } catch (err) {
        console.error('Failed to load playlist:', err);
        return null;
    }
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
    return await openFileAndReturnPaths();
});

async function openFileAndReturnPaths(filters) {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: filters || [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] },
            { name: 'Winamp Skins', extensions: ['wsz', 'zip'] }
        ]
    });

    if (result.canceled) {
        return null;
    } else {
        return result.filePaths;
    }
}

ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (result.canceled) return null;
    
    const folderPath = result.filePaths[0];
    const files = fs.readdirSync(folderPath);
    const audioFiles = files
        .filter(file => /\.(mp3|wav|ogg)$/i.test(file))
        .map(file => path.join(folderPath, file));
    
    return audioFiles;
});

ipcMain.handle('read-skin-file', async (event, filePath) => {
    try {
        return await fs.promises.readFile(filePath);
    } catch (err) {
        console.error("Failed to read skin file:", err);
        return null;
    }
});

ipcMain.on('show-context-menu', (event) => {
    const skinsDir = path.join(__dirname, 'skins');
    let skinItems = [];
    if (fs.existsSync(skinsDir)) {
        const files = fs.readdirSync(skinsDir);
        skinItems = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            const fullPath = path.join(skinsDir, file);
            return ext === '.wsz' || ext === '.zip' || fs.statSync(fullPath).isDirectory();
        });
    }

    const template = [
        { 
            label: 'Open File(s)', 
            click: async () => {
                const paths = await openFileAndReturnPaths();
                if (paths) event.sender.send('add-tracks', paths);
            } 
        },
        { 
            label: 'Open Folder', 
            click: async () => {
                const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
                if (!result.canceled) {
                    const folderPath = result.filePaths[0];
                    const files = fs.readdirSync(folderPath);
                    const audioFiles = files
                        .filter(file => /\.(mp3|wav|ogg)$/i.test(file))
                        .map(file => path.join(folderPath, file));
                    if (audioFiles.length > 0) event.sender.send('add-tracks', audioFiles);
                }
            } 
        },
        { type: 'separator' },
        {
            label: 'Themes',
            submenu: [
                { 
                    label: 'Default', 
                    click: () => event.sender.send('reset-skin') 
                },
                { type: 'separator' },
                ...skinItems.map(item => ({
                    label: item,
                    click: () => event.sender.send('load-skin', { 
                        name: item, 
                        path: path.join(skinsDir, item),
                        isDir: fs.statSync(path.join(skinsDir, item)).isDirectory()
                    })
                })),
                { type: 'separator' },
                { 
                    label: 'Load Skin...', 
                    click: async () => {
                        const paths = await openFileAndReturnPaths([{ name: 'Winamp Skins', extensions: ['wsz', 'zip'] }]);
                        if (paths && paths.length > 0) {
                            event.sender.send('load-skin', { 
                                name: path.basename(paths[0]), 
                                path: paths[0],
                                isDir: false
                            });
                        }
                    } 
                }
            ]
        },
        { type: 'separator' },
        { label: 'Quit Quinamp', click: () => app.quit() },
        { label: 'About Quinamp', click: () => createAboutWindow() }
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
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
