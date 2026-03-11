const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    const win = new BrowserWindow({ width: 800, height: 600 });

    // HTML page displaying the extracted PLEDIT.BMP
    const htmlContent = `
    <html>
        <body style="background: #333; margin: 0; padding: 20px;">
            <div style="color: white; margin-bottom: 10px;">PLEDIT.BMP Viewer (Grid lines 10px / 50px)</div>
            <div style="position: relative; display: inline-block;">
                <img src="file:///Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT.BMP" style="border: 1px solid lime;" id="bmp_img" />
                <canvas id="grid" style="position: absolute; top:0; left:0; width: 100%; height: 100%; pointer-events: none;"></canvas>
            </div>
            <script>
                window.onload = () => {
                    const img = document.getElementById('bmp_img');
                    const cvs = document.getElementById('grid');
                    cvs.width = img.width; cvs.height = img.height;
                    const ctx = cvs.getContext('2d');
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    for(let x=0; x<cvs.width; x+=10) {
                        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cvs.height); ctx.stroke();
                        if (x%50===0) { ctx.fillStyle='yellow'; ctx.fillText(x, x+2, 10); ctx.strokeStyle='yellow'; ctx.stroke(); }
                    }
                    for(let y=0; y<cvs.height; y+=10) {
                        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cvs.width,y); ctx.stroke();
                        if (y%50===0) { ctx.fillStyle='yellow'; ctx.fillText(y, 2, y+10); ctx.strokeStyle='yellow'; ctx.stroke(); }
                    }
                }
            </script>
        </body>
    </html>
    `;

    const tmpHtml = path.join(__dirname, 'show_pledit.html');
    fs.writeFileSync(tmpHtml, htmlContent);
    win.loadFile(tmpHtml);

    win.webContents.on('did-finish-load', async () => {
        await new Promise(r => setTimeout(r, 1000));
        const img = await win.webContents.capturePage();
        fs.writeFileSync('/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/pledit_grid_view.png', img.toPNG());
        setTimeout(() => app.quit(), 500);
    });
});
