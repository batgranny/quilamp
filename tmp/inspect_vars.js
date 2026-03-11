const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    const win = new BrowserWindow({ 
        width: 800, height: 600,
        webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true }
    });
    win.loadURL('http://localhost:5173');
    
    win.webContents.on('did-finish-load', async () => {
        await new Promise(r => setTimeout(r, 2000));
        const vars = await win.webContents.executeJavaScript(`
            const style = getComputedStyle(document.documentElement);
            ({
                bl: style.getPropertyValue('--skin-pledit-bottom-left'),
                br: style.getPropertyValue('--skin-pledit-bottom-right'),
                bf: style.getPropertyValue('--skin-pledit-bottom-fill')
            })
        `);
        console.log("Extracted CSS Vars:");
        console.log("BL:", vars.bl ? "Valid length " + vars.bl.length : "EMPTY");
        console.log("BR:", vars.br ? "Valid length " + vars.br.length : "EMPTY");
        console.log("BF:", vars.bf ? "Valid length " + vars.bf.length : "EMPTY");
        app.quit();
    });
});
