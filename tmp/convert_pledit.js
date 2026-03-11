const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const html = `
    <html>
    <body>
        <canvas id="c"></canvas>
        <script>
            const { ipcRenderer } = require('electron');
            const img = new Image();
            img.onload = () => {
                const c = document.getElementById('c');
                c.width = img.width;
                c.height = img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                ipcRenderer.send('done', c.toDataURL('image/png'));
            };
            img.src = 'file:///Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT.BMP';
        </script>
    </body>
    </html>
    `;
    const tmp = path.join(__dirname, 'dump_png.html');
    fs.writeFileSync(tmp, html);

    ipcMain.on('done', (e, data) => {
        const base64Data = data.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync('/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT_full.png', base64Data, 'base64');
        app.quit();
    });

    win.loadFile(tmp);
});
