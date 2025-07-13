const path = require('path');
const { updateGameDirectory, getGameDirectory } = require('../game_dir');

describe('game directory helpers', () => {
    test('updateGameDirectory stores directory', () => {
        const samplePath = path.join('some', 'folder', 'game.yaml');
        updateGameDirectory(samplePath);
        expect(getGameDirectory()).toBe(path.dirname(samplePath));
    });
});
