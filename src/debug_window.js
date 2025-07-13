const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const GameData = require('./game_data');

let debugWin = null;
let mainWin = null;

function createDebugWindow(parentWin) {
    mainWin = parentWin;
    if (debugWin) {
        debugWin.focus();
        return;
    }
    debugWin = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    debugWin.loadFile(path.join(__dirname, '../resources/web/debug.html'));

    debugWin.on('closed', () => {
        debugWin = null;
    });
}

function sendDebugState(gameEngine) {
    if (debugWin) {
        debugWin.webContents.send('debug-state', gameEngine.data.toJSON());
    }
}

ipcMain.on('debug-request-state', (event) => {
    if (mainWin && mainWin.webContents.gameInstance) {
        event.sender.send('debug-state', mainWin.webContents.gameInstance.data.toJSON());
    }
});

ipcMain.on('debug-save-state', (event, json) => {
    if (!mainWin || !mainWin.webContents.gameInstance) return;
    try {
        const obj = JSON.parse(json);
        const newData = new GameData(obj);
        mainWin.webContents.gameInstance.data = newData;
        mainWin.webContents.gameInstance.look();
        mainWin.webContents.gameInstance.listCommands();
        sendDebugState(mainWin.webContents.gameInstance);
    } catch (e) {
        console.error('Failed to update game state from debug window:', e);
    }
});

module.exports = { createDebugWindow, sendDebugState };
