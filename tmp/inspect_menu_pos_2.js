const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 800, height: 600,
        webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: false, nodeIntegration: true }
    });
    win.loadURL('http://localhost:5173');

    win.webContents.on('did-finish-load', async () => {
        try {
            await new Promise(r => setTimeout(r, 2000));
            const bounds = await win.webContents.executeJavaScript(`
                document.body.classList.add('skin-active');
                const menu = document.getElementById('pl-list-opts-menu');
                menu.classList.remove('collapsed');
                const rect = menu.getBoundingClientRect();
                const btn = document.getElementById('pl-btn-list-opts').getBoundingClientRect();
                const computed = getComputedStyle(menu);
                ({
                    menuVisible: computed.display,
                    menuZIndex: computed.zIndex,
                    menuTop: computed.top,
                    menuBottom: computed.bottom,
                    menuRight: computed.right,
                    rect: {x: rect.x, y: rect.y, w: rect.width, h: rect.height},
                    btnRect: {x: btn.x, y: btn.y, w: btn.width, h: btn.height}
                });
            `);
            console.log("DOM State:");
            console.log(JSON.stringify(bounds, null, 2));
        } catch (e) { console.error(e); }
        app.quit();
    });
});
