let currentGameDir = null;
const path = require('path');

function updateGameDirectory(yamlFilePath) {
    currentGameDir = path.dirname(yamlFilePath);
    console.log('Updated game directory:', currentGameDir);
}

function getGameDirectory() {
    return currentGameDir;
}

module.exports = { updateGameDirectory, getGameDirectory };
