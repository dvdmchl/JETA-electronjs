const path = require('path');

function resolveGameAssetPath(gameDirectory, requestUrl) {
    if (typeof requestUrl !== 'string' || !requestUrl.toLowerCase().startsWith('game:')) {
        throw new Error('Invalid game asset URL.');
    }

    const encodedPath = requestUrl.substring('game:'.length).split(/[?#]/, 1)[0];
    const relativePath = decodeURIComponent(encodedPath).replace(/^[/\\]+/, '');
    if (!relativePath) throw new Error('Game asset path is empty.');

    const basePath = path.resolve(gameDirectory);
    const filePath = path.resolve(basePath, relativePath);
    if (filePath !== basePath && !filePath.startsWith(basePath + path.sep)) {
        throw new Error('Game asset path escapes the game directory.');
    }
    return filePath;
}

module.exports = {resolveGameAssetPath};
