const path = require('path');
const {app, BrowserWindow, protocol} = require('electron');
const {createGameAssetResponse, registerGameScheme} = require('../src/game_protocol');

registerGameScheme(protocol);

app.whenReady().then(async () => {
    const gameDirectory = path.resolve(__dirname, '../samples/test');
    protocol.handle('game', request => createGameAssetResponse(gameDirectory, request.url));
    const win = new BrowserWindow({show: false});
    await win.loadURL('data:text/html,<img id="asset" src="game://local/ENDGAME.jpg">');
    const result = await win.webContents.executeJavaScript(`new Promise(resolve => {
        const image = document.getElementById('asset');
        const finish = () => resolve({complete: image.complete, width: image.naturalWidth});
        if (image.complete) finish();
        else {
            image.addEventListener('load', finish, {once: true});
            image.addEventListener('error', finish, {once: true});
        }
    })`);
    console.log(JSON.stringify(result));
    app.exit(result.complete && result.width > 0 ? 0 : 1);
}).catch(error => {
    console.error(error);
    app.exit(1);
});
