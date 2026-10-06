jest.mock('electron', () => ({
    ipcMain: {on: jest.fn()}, dialog: {}, app: {}, BrowserWindow: {},
    Menu: {buildFromTemplate: jest.fn(template => template), setApplicationMenu: jest.fn()}
}));
jest.mock('../debug_window', () => ({sendDebugState: jest.fn(), createDebugWindow: jest.fn()}));

const path = require('path');
const {loadAndPlayGame} = require('../menu');
const {parseGameFile} = require('../game_definition_loader');
const {getTranslatableFields} = require('../game_translations');
const i18next = require('../i18n');
const welcomePath = path.resolve(__dirname, '../../resources/index.yaml');

describe('welcome adventure', () => {
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    test('Czech translates every presentation field in the shared definition', () => {
        const {inputData} = parseGameFile(welcomePath);
        expect(Object.keys(inputData.translations.cs).sort()).toEqual([...getTranslatableFields(inputData).keys()].sort());
    });

    test.each([
        ['en', 'Every adventure', 'File → Open', 'Click.'],
        ['cs', 'Každé dobrodružství', 'Soubor → Otevřít', 'Klik.']
    ])('loads and plays in the selected %s application language', async (language, title, instruction, result) => {
        await i18next.changeLanguage(language);
        const win = {webContents: {send: jest.fn()}, setTitle: jest.fn()};
        expect(await loadAndPlayGame(welcomePath, win, undefined, language)).toBe(true);
        const engine = win.webContents.gameInstance;
        expect(engine.data.language).toBe(language);
        expect(engine.data.title).toContain(title);
        expect(engine.data.layoutTexts.openHint).toContain(instruction);
        const titles = win.webContents.send.mock.calls.filter(call => call[2] === 'game-title');
        expect(titles.every(call => call[1].includes(title))).toBe(true);
        engine.see('welcome_button');
        expect(engine.data.getValue('button_pressed')).toBe(false);
        engine.use('welcome_button');
        engine.look();
        expect(engine.data.getValue('button_pressed')).toBe(true);
        expect(win.webContents.send.mock.calls.some(call => call[1]?.includes?.(result))).toBe(true);
        engine.use('welcome_button');
        expect(win.webContents.send.mock.calls.some(call => call[1]?.includes?.(instruction))).toBe(true);
        engine.setLanguage(language === 'cs' ? 'en' : 'cs');
        expect(engine.data.getValue('button_pressed')).toBe(true);
        expect(engine.data.getValue('game_end', false)).toBe(false);
    });

    test('an unsupported application language falls back to the base welcome language', async () => {
        const win = {webContents: {send: jest.fn()}, setTitle: jest.fn()};
        expect(await loadAndPlayGame(welcomePath, win, undefined, 'xx')).toBe(true);
        expect(win.webContents.gameInstance.data.language).toBe('en');
    });
});
