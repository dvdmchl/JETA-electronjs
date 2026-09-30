const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { createWindow } = require('./src/jeta_ui.js');
const { getGameDirectory } = require('./src/game_dir');
const {resolveGameAssetPath} = require('./src/game_protocol');

const {pathToFileURL} = require('url');
const fs = require("fs");
const net = require("electron").net;

protocol.registerSchemesAsPrivileged([
    {scheme: 'game', privileges: {standard: true, secure: true, supportFetchAPI: true}}
]);

// Dynamická základní složka pro YAML je spravována v game_dir.js

// Funkce pro registraci `game://` protokolu
function setupGameProtocol() {
    if (protocol.isProtocolHandled('game')) {
        console.warn("Protocol 'game' is already registered.");
        return;
    }

    protocol.handle('game', async (request) => {
        const currentDir = getGameDirectory();
        if (!currentDir) {
            console.error("No game directory set!");
            return new Response("Game directory not set", { status: 500 });
        }

        try {
            const filePath = resolveGameAssetPath(currentDir, request.url);
            await fs.promises.access(filePath, fs.constants.F_OK);
            return net.fetch(pathToFileURL(filePath).href);
        } catch (err) {
            console.error("Game asset could not be loaded:", err.message);
            return new Response("Game asset could not be loaded", {status: 404});
        }
    });

    console.log("Protocol 'game' successfully registered.");
}


app.whenReady().then(() => {
    ipcMain.handle('ping', () => 'pong');
    setupGameProtocol();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Disable Autofill
app.on('web-contents-created', (event, contents) => {
    contents.on('did-finish-load', () => {
        contents.executeJavaScript(`
            if (window.Autofill) {
                window.Autofill.disable();
            }
        `);
    });
});

ipcMain.on('change-language', (event, lang) => {
    console.log(`Changing language to: ${lang}`);
    if (!lang) {
        console.error('Language is undefined');
        return;
    }
    const store = new (require('electron-store'))();
    store.set('language', lang);
    require('./i18n').changeLanguage(lang, (err) => {
        if (err) return console.error('Error changing language:', err);
        console.log('Language changed to:', lang);
        app.relaunch();
        app.exit();
    });
});
