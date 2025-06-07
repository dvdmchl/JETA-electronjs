const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { createWindow } = require('./src/jeta_ui.js');
const { loadGameLayout } = require('./src/game_layout');
const { updateGameDirectory, getGameDirectory } = require('./src/game_dir');

const path = require("path");
const fs = require("fs");
const net = require("electron").net;

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

        const urlPath = new URL(request.url).href.substring("game://".length);
        const filePath = path.join(currentDir, urlPath);

        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return net.fetch(`file://${filePath}`);
        } catch (err) {
            console.error("File not found:", filePath);
            return new Response("File not found", { status: 404 });
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

// Aktualizace cesty podle YAML souboru z renderer procesu
ipcMain.handle('set-game-directory', async (event, yamlFilePath) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const layoutLoaded = loadGameLayout(yamlFilePath, senderWindow);
    updateGameDirectory(yamlFilePath);
    return layoutLoaded;
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