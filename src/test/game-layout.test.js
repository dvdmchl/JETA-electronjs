jest.mock('electron', () => ({dialog: {showErrorBox: jest.fn()}}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const {encryptData} = require('../encryption');
const {parseGameFile} = require('../game_definition_loader');
const {loadGameLayout} = require('../game_layout');

describe('game layout loading', () => {
    test('uses an already parsed encrypted definition and resolves beside the definition', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeta-layout-'));
        const definitionPath = path.join(tempDir, 'game.enc');
        const layoutPath = path.join(tempDir, 'layout.html');
        const definition = {layout: {path: 'layout.html'}};
        fs.writeFileSync(layoutPath, '<div id="game-output"></div>');
        fs.writeFileSync(definitionPath, `aes\n${encryptData(JSON.stringify(definition), 'aes')}`);
        const parsed = parseGameFile(definitionPath).inputData;
        const win = {webContents: {send: jest.fn()}};
        expect(loadGameLayout(parsed, definitionPath, win)).toBe(true);
        expect(win.webContents.send).toHaveBeenCalledWith('set-game-layout', '<div id="game-output"></div>');
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    test('rejects a custom layout outside the game directory', () => {
        const win = {webContents: {send: jest.fn()}};
        expect(loadGameLayout({layout: {path: '../layout.html'}}, path.join(os.tmpdir(), 'game', 'game.yaml'), win)).toBe(false);
        expect(win.webContents.send).not.toHaveBeenCalled();
    });
});
