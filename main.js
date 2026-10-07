// Bridge desktop shell (Electron) - (c) Albatany 2026
const { app, BrowserWindow, Menu, Notification, shell } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const { events } = require('./server');   // starts discovery + local server
  let win;
  const notify = (title, body) => { if (!win || !win.isFocused()) new Notification({ title, body }).show(); };
  events.on('chat', m => notify(m.from, m.text.slice(0, 120)));
  events.on('file', f => notify('File diterima dari ' + f.from, f.name));

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1000, height: 780, title: 'Bridge', backgroundColor: '#0a1730',
      icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true
    });
    win.loadURL('http://localhost:' + (process.env.PORT || 7777));
    win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  });
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  app.on('window-all-closed', () => app.quit());
}
