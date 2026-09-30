const fs = require('fs');
const path = require('path');

const CONTENT_TYPES = {
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

function registerGameScheme(protocol) {
    protocol.registerSchemesAsPrivileged([
        {scheme: 'game', privileges: {standard: true, secure: true, supportFetchAPI: true}}
    ]);
}

function resolveGameAssetPath(gameDirectory, requestUrl) {
    if (typeof requestUrl !== 'string' || !requestUrl.toLowerCase().startsWith('game:')) {
        throw new Error('Invalid game asset URL.');
    }

    const url = new URL(requestUrl);
    const legacyHost = url.hostname && url.hostname !== 'local' ? `${url.hostname}/` : '';
    const relativePath = decodeURIComponent(legacyHost + url.pathname).replace(/^[/\\]+/, '');
    if (!relativePath) throw new Error('Game asset path is empty.');

    const basePath = path.resolve(gameDirectory);
    const filePath = path.resolve(basePath, relativePath);
    if (filePath !== basePath && !filePath.startsWith(basePath + path.sep)) {
        throw new Error('Game asset path escapes the game directory.');
    }
    return filePath;
}

async function createGameAssetResponse(gameDirectory, requestUrl) {
    const filePath = resolveGameAssetPath(gameDirectory, requestUrl);
    const content = await fs.promises.readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    return new Response(content, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        }
    });
}

module.exports = {createGameAssetResponse, registerGameScheme, resolveGameAssetPath};
