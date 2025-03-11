const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { createWindow } = require('./src/jeta_ui.js');

const path = require("path");
const fs = require("fs");
const net = require("electron").net;

let currentGameDir = null; // Dynamická základní složka pro YAML

// Funkce pro registraci `game://` protokolu
function setupGameProtocol() {
    if (protocol.isProtocolHandled('game')) {
        console.warn("Protocol 'game' is already registered.");
        return;
    }

    protocol.handle('game', async (request) => {
        if (!currentGameDir) {
            console.error("No game directory set!");
            return new Response("Game directory not set", { status: 500 });
        }

        const urlPath = new URL(request.url).href.substring("game://".length);
        const filePath = path.join(currentGameDir, urlPath);

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

// Funkce pro aktualizaci cesty k YAML souborům
function updateGameDirectory(yamlFilePath) {
    currentGameDir = path.dirname(yamlFilePath);
    console.log("Updated game directory:", currentGameDir);
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
ipcMain.on('set-game-directory', (event, yamlFilePath) => {
    updateGameDirectory(yamlFilePath);
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