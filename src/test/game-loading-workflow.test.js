jest.mock('electron', () => ({
    app: {getPath: jest.fn()},
    Menu: {buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn()},
    BrowserWindow: {},
    ipcMain: {on: jest.fn()},
    dialog: {showOpenDialog: jest.fn(), showSaveDialog: jest.fn(), showMessageBox: jest.fn()}
}));
jest.mock('../game_definition_loader', () => ({loadGameFile: jest.fn()}));
jest.mock('../game_engine', () => ({play: jest.fn()}));
jest.mock('../debug_window', () => ({createDebugWindow: jest.fn()}));

const fs = require('fs');
const {loadGameFile} = require('../game_definition_loader');
const {play} = require('../game_engine');
const {loadAndPlayGame, watchAndReloadGame} = require('../menu');

describe('canonical load and watched reload workflow', () => {
    afterEach(() => jest.restoreAllMocks());

    test('a watched edit starts a fresh game instance without duplicate watchers', async () => {
        const first = {id: 'first'};
        const second = {id: 'second'};
        loadGameFile.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
        const win = {webContents: {send: jest.fn()}, setTitle: jest.fn()};
        const watchCallbacks = [];
        const watch = jest.spyOn(fs, 'watchFile').mockImplementation((file, callback) => watchCallbacks.push(callback));
        const unwatch = jest.spyOn(fs, 'unwatchFile').mockImplementation(() => {});

        expect(await loadAndPlayGame('game.yaml', win)).toBe(true);
        watchAndReloadGame('game.yaml', win);
        watchAndReloadGame('game.yaml', win);
        expect(watch).toHaveBeenCalledTimes(2);
        expect(unwatch).toHaveBeenCalledWith('game.yaml');

        await watchCallbacks[1]({mtimeMs: 2}, {mtimeMs: 1});
        expect(play).toHaveBeenNthCalledWith(1, first, win);
        expect(play).toHaveBeenNthCalledWith(2, second, win);
        expect(win.webContents.send).toHaveBeenCalledTimes(2);
        expect(win.webContents.send).toHaveBeenCalledWith('clear-output');
    });
});
