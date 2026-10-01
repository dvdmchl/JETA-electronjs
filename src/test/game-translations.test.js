jest.mock('electron', () => ({
    ipcMain: {on: jest.fn()}, dialog: {},
    Menu: {buildFromTemplate: jest.fn(template => template), setApplicationMenu: jest.fn()},
    BrowserWindow: {}, app: {}
}));
jest.mock('../debug_window', () => ({sendDebugState: jest.fn(), createDebugWindow: jest.fn()}));

const path = require('path');
const fs = require('fs');
const GameData = require('../game_data');
const {GameEngine} = require('../game_engine');
const {prepareGameDefinition, parseGameFile} = require('../game_definition_loader');
const {getTranslatableFields} = require('../game_translations');
const {createMenu} = require('../menu');
const i18next = require('../i18n');

function definition() {
    return parseGameFile(path.resolve(__dirname, '../../samples/stiny_azerothu/stiny_azerothu.yaml')).inputData;
}

function createGame(input = definition()) {
    const data = new GameData(prepareGameDefinition(input));
    const win = {webContents: {send: jest.fn()}};
    const engine = new GameEngine(data, win);
    win.webContents.gameInstance = engine;
    return {data, engine, win};
}

describe('state-preserving game translations', () => {
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    test('English covers every sample presentation field and switches the introduction and labels', () => {
        const input = definition();
        expect(Object.keys(input.translations.en).sort()).toEqual([...getTranslatableFields(input).keys()].sort());
        const {engine, data, win} = createGame(input);
        engine.start();
        engine.setLanguage('en');
        expect(data.title).toBe('Shadows of Azeroth');
        expect(data.layoutTexts.log).toBe('Event journal');
        const updates = win.webContents.send.mock.calls;
        expect(updates.filter(call => call[2] === 'game-location').at(-1)[1]).toContain('The Third War');
        expect(updates.filter(call => call[2] === 'game-commands').at(-1)[1]).toContain('look around');
        engine.setLanguage('cs');
        expect(data.title).toBe('Stíny Azerothu');
        expect(data.layoutTexts.log).toBe('Deník událostí');
        expect(win.webContents.send).not.toHaveBeenCalledWith('clear-output');
    });

    test('switching active dialogue refreshes choices without replaying assignments', () => {
        const input = definition();
        input.characters.find(character => character.id === 'goblin').onTalk[0].set = 'gold_coins = gold_coins + 1';
        const {engine, data, win} = createGame(input);
        engine.go('booty_bay');
        engine.talk('goblin');
        engine.setLanguage('en');
        expect(data.player.location).toBe('booty_bay');
        expect(data.getValue('gold_coins')).toBe(1);
        expect(win.webContents.send.mock.calls.at(-1)[1]).toContain('Accept the parcel');
        engine.handleDialogChoice({characterId: 'goblin', choiceId: 'accept_package'});
        expect(data.getValue('package:owner')).toBe('player');
        engine.setLanguage('cs');
        expect(data.getValue('gold_coins')).toBe(1);
        expect(data.getValue('package:owner')).toBe('player');
    });

    test('switching after leaving an NPC does not redisplay their remote choices', () => {
        const {engine, win} = createGame();
        engine.go('booty_bay');
        engine.talk('goblin');
        engine.go('tirisfal_grove');
        win.webContents.send.mockClear();
        engine.setLanguage('en');
        expect(win.webContents.send.mock.calls.filter(call => call[0] === 'game-update' && !call[2])).toHaveLength(0);
        expect(engine.activeDialogues.get('goblin')).toBe('delivery_offer');
    });

    test('a saved English game restores language, variables and a half-solved puzzle', () => {
        const {engine, data} = createGame();
        engine.see('unlock_temple');
        data.setValue('custom_progress', 17);
        engine.talk('rune_keeper');
        engine.handleDialogChoice({characterId: 'rune_keeper', choiceId: 'water'});
        engine.setLanguage('en');
        expect(data.getValue('unlock_temple:onSee:count')).toBe(1);
        const restored = new GameData(prepareGameDefinition(JSON.parse(data.toJSON())));
        expect(restored.language).toBe('en');
        expect(restored.getValue('custom_progress')).toBe(17);
        expect(restored.parseCondition('rune_step = 1')).toBe(true);
        expect(restored.getDialogueOptions('rune_keeper', 'runes_fire')[1].text).toBe('Fire');
        restored.setLanguage('cs');
        expect(restored.getDialogueOptions('rune_keeper', 'runes_fire')[1].text).toBe('Oheň');
        expect(restored.getValue('custom_progress')).toBe(17);
    });

    test('switching an ending translates it without replaying ending effects or restoring commands', () => {
        const input = definition();
        input.endings[0].descriptions[0].set += '; gold_coins = gold_coins + 1';
        const {engine, data, win} = createGame(input);
        data.parseSet('game_end = true; game_end_id = ending_destroy');
        engine.listEndings();
        engine.setLanguage('en');
        engine.setLanguage('cs');
        expect(data.getValue('gold_coins')).toBe(1);
        expect(data.getValue('game-commands-show')).toBe(false);
        expect(win.webContents.send.mock.calls.filter(call => call[2] === 'game-location').map(call => call[1]).join(' ')).toContain('A Dawn Without Masters');
    });

    test('partial translations fall back to base text and unavailable languages leave the game untouched', () => {
        const input = definition();
        input.translations = {en: {'/metadata/title': 'Shadows'}};
        const {data} = createGame(input);
        data.setLanguage('en');
        expect(data.items[0].name).toBe('Cestovní deník');
        const saved = data.toJSON();
        expect(() => data.setLanguage('fr')).toThrow(/Unavailable/);
        expect(data.toJSON()).toBe(saved);
        data.setLanguage('cs');
        expect(data.title).toBe('Stíny Azerothu');
    });

    test.each(['/items/0/owner', '/characters/0/location', '/variables/0/value', '/characters/2/onTalk/0/set', '/metadata/language', '/locations/99/name', '/__proto__/name'])('rejects non-presentation translation target %s', pointer => {
        const input = definition();
        input.translations.en[pointer] = 'player';
        expect(() => prepareGameDefinition(input)).toThrow(/Invalid translation/);
    });

    test('rejects invalid translation values and sanitizes translated narrative', () => {
        const input = definition();
        input.translations.en['/metadata/title'] = 12;
        expect(() => prepareGameDefinition(input)).toThrow(/Schema validation/);
        input.translations.en['/metadata/title'] = '<script>alert(1)</script><h1 onclick="bad()">Title</h1>';
        const {data} = createGame(input);
        data.setLanguage('en');
        expect(data.title).not.toContain('<script>');
        expect(data.title).not.toContain('onclick');
    });

    test('rejects an invalid base language before materializing translation maps', () => {
        const input = definition();
        input.metadata.language = '__proto__';
        expect(() => prepareGameDefinition(input)).toThrow(/base language code/);
    });

    test('game menu switches independently of application language and disables single-language games', () => {
        const {data, engine, win} = createGame();
        const store = {set: jest.fn()};
        const menu = createMenu('cs', store, win);
        const languages = menu[0].submenu.find(item => item.label === i18next.t('menu.gameLanguage'));
        expect(languages.enabled).toBe(true);
        languages.submenu.find(item => !item.checked).click();
        expect(data.language).toBe('en');
        expect(store.set).not.toHaveBeenCalled();
        engine.data = new GameData(prepareGameDefinition(parseGameFile(path.resolve('resources/game_definition_template.yaml')).inputData));
        const single = createMenu('en', store, win)[0].submenu.find(item => item.label === i18next.t('menu.gameLanguage'));
        expect(single.enabled).toBe(false);
    });

    test('application and game locale keys stay aligned', () => {
        const cs = JSON.parse(fs.readFileSync(path.resolve('locales/cs.json'), 'utf8'));
        const en = JSON.parse(fs.readFileSync(path.resolve('locales/en.json'), 'utf8'));
        expect(Object.keys(cs.game).sort()).toEqual(Object.keys(en.game).sort());
        expect(Object.keys(cs.menu).sort()).toEqual(Object.keys(en.menu).sort());
    });
});
