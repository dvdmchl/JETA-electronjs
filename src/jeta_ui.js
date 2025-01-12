const {loadGameFile} = require("./game_definition_loader");
const {play} = require("./game_engine");

const {BrowserWindow, Menu} = require('electron');
const path = require('path');
const i18next = require('./i18n');
const {createMenu} = require('./menu');

let win;
let menu;

const createWindow = async () => {
    const Store = (await import('electron-store')).default;
    const store = new Store();
    const windowState = store.get('windowState') || {width: 1280, height: 760};
    let currentLanguage = store.get('language') || 'en';
    const devMode = store.get('devMode') || false;

    win = new BrowserWindow({
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        title: 'Jeta',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Change language and update menu
    i18next.changeLanguage(currentLanguage, (err, t) => {
        if (err) return console.error('Error changing language:', err);
        win.loadFile(`./resources/web/index.html`);
        win.once('ready-to-show', () => {
            win.show();
            win.webContents.send('set-language', t('index', {returnObjects: true}), currentLanguage);
        });

        menu = createMenu(currentLanguage, store, win);
        Menu.setApplicationMenu(menu);
        let indexName = 'index' + '_' + currentLanguage + '.yaml';
        let indexGameFilePath = path.join(__dirname, '../resources/' + indexName);
        console.log('Loading game data from:', indexGameFilePath);
        const indexGameData = loadGameFile(indexGameFilePath);
        if (indexGameData) {
            console.log('Game data loaded successfully.');
            play(indexGameData, win);
            console.log('Game started.');
        } else {
            console.error('Failed to load game data.');
        }
    });

    console.log('DevMode:', devMode);
    if (devMode) {
        win.webContents.openDevTools();
    }

    win.on('close', () => {
        const bounds = win.getBounds();
        store.set('windowState', bounds);
    });

    win.webContents.on('devtools-opened', () => {
        console.log('DevTools opened');
        store.set('devMode', true);
    });

    win.webContents.on('devtools-closed', () => {
        console.log('DevTools closed');
        store.set('devMode', false);
    });

};

function getMenu() {
    return menu;
}

module.exports = {createWindow, getMenu};