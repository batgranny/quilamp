const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 413, height: 696,
        webPreferences: { preload: path.join(__dirname, '../preload.js'), nodeIntegration: false, contextIsolation: true }
    });
    win.loadURL('http://localhost:5173');
    
    win.webContents.on('did-finish-load', async () => {
        await new Promise(r => setTimeout(r, 2000));
        
        const img1 = await win.webContents.capturePage();
        fs.writeFileSync('/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/list_opts_initial.png', img1.toPNG());
        console.log("Initial state captured.");

        await win.webContents.executeJavaScript(`
            const btn = document.getElementById('pl-btn-list-opts');
            if (btn) btn.click();
        `);
        
        await new Promise(r => setTimeout(r, 1000));
        
        const img2 = await win.webContents.capturePage();
        fs.writeFileSync('/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/list_opts_expanded.png', img2.toPNG());
        console.log("Expanded menu captured.");
        
        app.quit();
    });
});
