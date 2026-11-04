// Rend build/icon.html en PNG 1024x1024 : ./node_modules/.bin/electron build/make-icon.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, backgroundColor: '#00000000', webPreferences: { offscreen: true } });
  await w.loadFile(path.join(__dirname, 'icon.html'));
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.join(__dirname, 'icon.png'), img.resize({ width: 1024, height: 1024 }).toPNG());
  app.exit(0);
});
