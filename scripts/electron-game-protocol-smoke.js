const path = require('path');
const {app, BrowserWindow, protocol} = require('electron');
const {createGameAssetResponse, registerGameScheme} = require('../src/game_protocol');

registerGameScheme(protocol);

app.whenReady().then(async () => {
    const gameDirectory = path.resolve(__dirname, '../samples/test');
    protocol.handle('game', request => createGameAssetResponse(gameDirectory, request.url));
    const win = new BrowserWindow({show: false});
    await win.loadFile(path.resolve(__dirname, '../resources/web/index.html'));
    const result = await win.webContents.executeJavaScript(`new Promise(resolve => {
        const image = document.createElement('img');
        image.id = 'asset';
        image.addEventListener('load', () => resolve({event: 'load', complete: image.complete, width: image.naturalWidth}), {once: true});
        image.addEventListener('error', () => resolve({event: 'error', complete: image.complete, width: image.naturalWidth}), {once: true});
        image.src = 'game://local/ENDGAME.jpg';
        document.body.replaceChildren(image);
    })`);
    console.log(JSON.stringify(result));
    app.exit(result.complete && result.width > 0 ? 0 : 1);
}).catch(error => {
    console.error(error);
    app.exit(1);
});
