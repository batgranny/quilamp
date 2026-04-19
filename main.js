const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Force application name for macOS menu bar when running unpackaged
if (process.platform === 'darwin') {
    app.setName('Quilamp');
}

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let mainWindow = null;
let visualizerWindow = null;
let pendingFiles = [];

// Helper to get skin items for menus
function getSkinItems() {
    const skinsDir = path.join(__dirname, 'skins');
    if (fs.existsSync(skinsDir)) {
        const files = fs.readdirSync(skinsDir);
        return files
            .filter(file => path.extname(file).toLowerCase() === '.wsz')
            .map(file => ({
                name: file,
                label: path.basename(file, '.wsz').replace(/_/g, ' ')
            }));
    }
    return [];
}

// Shared menu template builder
function getMenuTemplate(focusedWindow) {
    const skinItems = getSkinItems();
    const skinsDir = path.join(__dirname, 'skins');

    return [
        {
            label: app.name,
            submenu: [
                { label: 'About Quilamp', click: createAboutWindow },
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
                {
                    label: 'Open File(s)',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const paths = await openFileAndReturnPaths();
                        if (paths && focusedWindow) focusedWindow.webContents.send('add-tracks', paths);
                    }
                },
                {
                    label: 'Open Folder',
                    click: async () => {
                        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
                        if (!result.canceled && focusedWindow) {
                            const folderPath = result.filePaths[0];
                            const files = fs.readdirSync(folderPath);
                            const audioFiles = files
                                .filter(file => /\.(mp3|wav|ogg)$/i.test(file))
                                .map(file => path.join(folderPath, file));
                            if (audioFiles.length > 0) focusedWindow.webContents.send('add-tracks', audioFiles);
                        }
                    }
                },
                { type: 'separator' },
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
                {
                    label: 'Playlist',
                    accelerator: 'CmdOrCtrl+L',
                    click: () => {
                        if (focusedWindow) focusedWindow.webContents.send('toggle-playlist');
                    }
                },
                {
                    label: 'Visualizer',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => createVisualizerWindow()
                },
                { type: 'separator' },
                {
                    label: 'Themes',
                    submenu: [
                        {
                            label: 'Default',
                            click: () => {
                                if (focusedWindow) focusedWindow.webContents.send('reset-skin');
                            }
                        },
                        { type: 'separator' },
                        ...skinItems.map(item => ({
                            label: item.label,
                            click: () => {
                                if (focusedWindow) {
                                    focusedWindow.webContents.send('load-skin', {
                                        name: item.name,
                                        path: path.join(skinsDir, item.name),
                                        isDir: false
                                    });
                                }
                            }
                        })),
                        { type: 'separator' },
                        {
                            label: 'Load Skin...',
                            click: async () => {
                                const paths = await openFileAndReturnPaths([{ name: 'Winamp Skins', extensions: ['wsz', 'zip'] }]);
                                if (paths && paths.length > 0 && focusedWindow) {
                                    focusedWindow.webContents.send('load-skin', {
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
                        await shell.openExternal('https://github.com/chrisconnolly/quilamp');
                    }
                }
            ]
        }
    ];
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 414,
        minWidth: 414,
        maxWidth: 414,
        height: 465, // 310 logical px * 1.5
        minHeight: 210, // 140 logical px * 1.5
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        frame: false,
        transparent: true,
        resizable: true, // OS window resizable vertically
        maximizable: false,
        icon: path.join(__dirname, 'build/icon.png')
    });
    if (isDev) {
        // Try to load via Vite dev server if running, else load local index.html
        mainWindow.loadURL('http://localhost:5173').catch(() => {
            mainWindow.loadFile(path.join(__dirname, 'index.html'));
        });
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    // Pass pending files to renderer once it's completely ready to handle IPC
    mainWindow.webContents.on('did-finish-load', () => {
        if (pendingFiles.length > 0) {
            mainWindow.webContents.send('add-tracks', pendingFiles);
            pendingFiles = [];
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Set up initial Application Menu
    const menu = Menu.buildFromTemplate(getMenuTemplate(mainWindow));
    Menu.setApplicationMenu(menu);
}

function createAboutWindow() {
    const aboutWindow = new BrowserWindow({
        width: 350,
        height: 380,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'About Quilamp',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        frame: true, // Standard window for About
        backgroundColor: '#2c2c2c',
        icon: path.join(__dirname, 'build/icon.png')
    });

    // Remove menu bar for About window on other platforms if needed
    aboutWindow.setMenu(null);

    aboutWindow.loadFile(path.join(__dirname, 'about.html'));
}

function createVisualizerWindow() {
    if (visualizerWindow) {
        visualizerWindow.focus();
        return;
    }

    visualizerWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Quilamp ProjectM Visualizer',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        backgroundColor: '#000000',
        icon: path.join(__dirname, 'build/icon.png')
    });

    if (isDev) {
        visualizerWindow.loadURL('http://localhost:5173/visualizer.html').catch(() => {
            visualizerWindow.loadFile(path.join(__dirname, 'visualizer.html'));
        });
        visualizerWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        visualizerWindow.loadFile(path.join(__dirname, 'dist/visualizer.html'));
    }

    visualizerWindow.on('closed', () => {
        visualizerWindow = null;
    });
}

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

ipcMain.handle('resize-window', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const bounds = win.getBounds();
        // Update both boundaries and minimum size constraints so resizing respects the layout
        win.setMinimumSize(Math.round(width), Math.round(height));
        win.setBounds({
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            width: Math.round(width),
            height: Math.round(height)
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

ipcMain.on('audio-data', (event, data) => {
    if (visualizerWindow && !visualizerWindow.isDestroyed()) {
        visualizerWindow.webContents.send('audio-data', data);
    }
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

app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
        mainWindow.webContents.send('add-tracks', [filePath]);
    } else {
        pendingFiles.push(filePath);
        // If app is ready but window is closed, create it
        if (app.isReady() && !mainWindow) {
            createWindow();
        }
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

ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
});

ipcMain.on('show-context-menu', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const template = getMenuTemplate(win);

    // Filter out top-level roles that don't make sense in context menu if needed
    // But for simplicity, we'll just extract the specific ones requested
    const contextTemplate = [
        template.find(m => m.label === 'File').submenu[0], // Open File
        template.find(m => m.label === 'File').submenu[1], // Open Folder
        { type: 'separator' },
        template.find(m => m.label === 'View').submenu[0], // Playlist
        template.find(m => m.label === 'View').submenu[1], // Visualizer
        template.find(m => m.label === 'View').submenu[3], // Themes (at index 3 after separator)
        { type: 'separator' },
        { label: 'Quit Quilamp', click: () => app.quit() },
        { label: 'About Quilamp', click: () => createAboutWindow() }
    ];

    const menu = Menu.buildFromTemplate(contextTemplate);
    menu.popup(win);
});

ipcMain.handle('get-metadata', async (event, filePath) => {
    try {
        const mm = await import('music-metadata');
        const metadata = await mm.parseFile(filePath, { duration: true });
        return {
            title: metadata.common.title || null,
            artist: metadata.common.artist || null,
            duration: metadata.format.duration || null,
            bitrate: metadata.format.bitrate || null,
            sampleRate: metadata.format.sampleRate || null
        };
    } catch (err) {
        console.error("Failed to read metadata:", err);
        return null;
    }
});
