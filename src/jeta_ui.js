const { BrowserWindow, Menu } = require('electron');
const path = require('path');
const i18next = require('./i18n');
const { createMenu } = require('./menu');

let win;

const createWindow = async () => {
    const Store = (await import('electron-store')).default;
    const store = new Store();
    const windowState = store.get('windowState') || { width: 1280, height: 760 };
    let currentLanguage = store.get('language') || 'en';
    const devMode = store.get('devMode') || false;

    win = new BrowserWindow({
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    i18next.changeLanguage(currentLanguage);
    win.loadFile(`./resources/web/index.html`);
    win.once('ready-to-show', () => {
        win.show();
        win.webContents.send('set-language', i18next.getDataByLanguage(currentLanguage).index, currentLanguage);
    });

    if (devMode) {
        win.webContents.openDevTools();
    }

    const menu = createMenu(currentLanguage, store, win);
    Menu.setApplicationMenu(menu);

    win.on('close', () => {
        const bounds = win.getBounds();
        store.set('windowState', bounds);
    });

    win.webContents.on('devtools-opened', () => {
        store.set('devMode', true);
    });

    win.webContents.on('devtools-closed', () => {
        store.set('devMode', false);
    });

};

module.exports = { createWindow };