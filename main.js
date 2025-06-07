const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { createWindow } = require('./src/jeta_ui.js');

const path = require("path");
const fs = require("fs");
const net = require("electron").net;
const yaml = require('js-yaml');

let currentGameDir = null; // Dynamická základní složka pro YAML

function loadGameLayout(yamlFilePath, mainWindow) {
    try {
        const yamlContent = fs.readFileSync(yamlFilePath, 'utf8');
        const yamlData = yaml.load(yamlContent);

        let layoutPath;

        // Zkontroluje, zda YAML definuje vlastní layout
        if (yamlData.layout && yamlData.layout.path) {
            const yamlDir = path.dirname(yamlFilePath);
            layoutPath = path.join(yamlDir, yamlData.layout.path);
        } else {
            // Použije výchozí layout
            layoutPath = path.join(__dirname, 'resources', 'layout_default.html');
        }

        if (fs.existsSync(layoutPath)) {
            const layoutContent = fs.readFileSync(layoutPath, 'utf8');
            mainWindow.webContents.send('set-game-layout', layoutContent);
            console.log(`Layout loaded from: ${layoutPath}`);
            return true;
        } else {
            console.error(`Soubor layoutu nenalezen: ${layoutPath}`);
            return false;
        }
    } catch (error) {
        console.error('Chyba při načítání layoutu:', error);
        return false;
    }
}

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
ipcMain.handle('set-game-directory', async (event, yamlFilePath) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const layoutLoaded = await loadGameLayout(yamlFilePath, senderWindow);
    await updateGameDirectory(yamlFilePath);
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