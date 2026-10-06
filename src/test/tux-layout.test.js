jest.mock('electron', () => ({ipcMain: {on: jest.fn()}, dialog: {showErrorBox: jest.fn()}}));
jest.mock('../debug_window', () => ({sendDebugState: jest.fn()}));

const fs = require('fs');
const path = require('path');
const GameData = require('../game_data');
const {GameEngine} = require('../game_engine');
const {parseGameFile, prepareGameDefinition} = require('../game_definition_loader');
const {LAYOUT_SECTIONS} = require('../layout_sections');
const {resolveGameAssetPath} = require('../game_protocol');

const file = path.resolve(__dirname, '../../samples/Tux/Tux.yaml');
const directory = path.dirname(file);

describe('Tux location presentation', () => {
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    function createGame() {
        const {inputData} = parseGameFile(file);
        const data = new GameData(prepareGameDefinition(inputData));
        const messages = [];
        const engine = new GameEngine(data, {webContents: {send: (...args) => messages.push(args)}});
        return {data, engine, messages};
    }

    test('every location renders its own local decorative image through the production sanitizer', () => {
        const {data, engine, messages} = createGame();
        const assets = new Set();
        for (const location of Object.values(data.locations)) {
            data.player.location = location.id;
            engine.look();
            const markup = messages.at(-1)[1];
            const image = markup.match(/<img class="scene-backdrop" src="([^"]+)" alt="">/);
            expect(image).not.toBeNull();
            expect(markup).toContain(`<h2>${location.name}</h2>`);
            const asset = resolveGameAssetPath(directory, image[1]);
            expect(fs.statSync(asset).size).toBeGreaterThan(1000);
            assets.add(asset);
        }
        expect(assets.size).toBe(Object.keys(data.locations).length);
    });

    test('intro, revisits and ending retain a background and all engine sections', () => {
        const {data, engine, messages} = createGame();
        const layout = fs.readFileSync(path.join(directory, 'layout.html'), 'utf8');
        for (const {id} of LAYOUT_SECTIONS) {
            expect(layout.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
        }
        engine.start();
        expect(messages.find(message => message[2] === 'game-location')[1]).toContain('scene-backdrop');
        const original = engine.getLookText();
        engine.look();
        expect(messages.at(-1)[1]).toBe(original);
        expect(data.getValue('game-log-title-show')).toBe(true);
        data.setValue('game_end', true);
        data.setValue('game_end_id', 'tuxie_search');
        engine.listEndings();
        const ending = messages.filter(message => message[2] === 'game-location').at(-1)[1];
        expect(ending).toContain('game://local/images/UPapoucha.webp');
        expect(ending).toContain('Tuxie, jdu si pro tebe!');
    });
});
