jest.mock('electron', () => ({ipcMain: {on: jest.fn()}, dialog: {showErrorBox: jest.fn()}}));
jest.mock('../debug_window', () => ({sendDebugState: jest.fn()}));

const path = require('path');
const fs = require('fs');
const GameData = require('../game_data');
const {GameEngine} = require('../game_engine');
const {parseGameFile, prepareGameDefinition} = require('../game_definition_loader');
const {LAYOUT_SECTIONS} = require('../layout_sections');

const sample = path.resolve(__dirname, '../../samples/stiny_azerothu/stiny_azerothu.yaml');

function createGame(language = 'cs') {
    const {inputData} = parseGameFile(sample);
    const sent = [];
    const data = new GameData(prepareGameDefinition(inputData));
    data.setLanguage(language);
    const engine = new GameEngine(data, {webContents: {send: (...args) => sent.push(args)}});
    return {engine, data, sent};
}

function choose(engine, characterId, choiceId) {
    engine.talk(characterId);
    const entryId = engine.activeDialogues.get(characterId);
    expect(entryId).toBeDefined();
    expect(engine.data.getDialogueOptions(characterId, entryId).map(option => option.id)).toContain(choiceId);
    engine.handleDialogChoice({characterId, entryId, choiceId});
}

function earnRewards(engine) {
    engine.go('booty_bay');
    choose(engine, 'goblin', 'accept_package');
    engine.go('stranglethorn_vale');
    choose(engine, 'courier', 'deliver_package');
    engine.go('booty_bay');
    choose(engine, 'goblin', 'collect_reward');
    engine.go('tirisfal_grove');
}

function solveRunes(engine) {
    for (const answer of ['water', 'fire', 'wind', 'earth']) {
        choose(engine, 'rune_keeper', answer);
    }
}

describe('Stíny Azerothu playable sample', () => {
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    test('loads through the production contract and retains every layout target', () => {
        const {engine, data, sent} = createGame();
        engine.start();
        engine.listCommands();
        expect(data.player.location).toBe('tirisfal_grove');
        expect(sent.find(message => message[2] === 'game-location')[1]).toContain('Tirisfalský háj');
        const layout = fs.readFileSync(path.join(path.dirname(sample), 'layout.html'), 'utf8');
        for (const {id} of LAYOUT_SECTIONS) {
            expect(layout.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
        }
    });

    test('delivery and rewards require the package and cannot be repeated', () => {
        const {engine, data} = createGame();
        engine.go('booty_bay');
        choose(engine, 'goblin', 'accept_package');
        engine.drop('package');
        engine.go('stranglethorn_vale');
        engine.talk('courier');
        expect(data.getValue('package_delivered')).toBe(false);
        engine.go('booty_bay');
        engine.take('package');
        engine.go('stranglethorn_vale');
        choose(engine, 'courier', 'deliver_package');
        expect(data.getValue('package:owner')).toBe('courier_satchel');
        engine.go('booty_bay');
        choose(engine, 'goblin', 'collect_reward');
        engine.drop('map_to_temple');
        engine.talk('goblin');
        expect(data.getValue('map_to_temple:owner')).toBe('booty_bay');
        expect(data.getValue('gold_coins')).toBe(50);
        engine.take('map_to_temple');
        expect(data.getValue('map_to_temple:owner')).toBe('player');
    });

    test('temple needs the map, patrol permission and runes; wrong answers reset safely', () => {
        const {engine, data} = createGame();
        engine.go('nathrezim_temple');
        expect(data.player.location).toBe('tirisfal_grove');
        earnRewards(engine);
        choose(engine, 'rune_keeper', 'fire');
        expect(data.parseCondition('rune_step = 0')).toBe(true);
        choose(engine, 'rune_keeper', 'water');
        choose(engine, 'rune_keeper', 'earth');
        expect(data.parseCondition('rune_step = 0')).toBe(true);
        solveRunes(engine);
        engine.go('nathrezim_temple');
        expect(data.player.location).toBe('tirisfal_grove');
        engine.drop('amulet_of_peace');
        engine.talk('forsaken_patrol');
        expect(data.getValue('patrol_passage')).toBe(false);
        engine.take('amulet_of_peace');
        choose(engine, 'forsaken_patrol', 'show_amulet');
        engine.drop('map_to_temple');
        engine.go('nathrezim_temple');
        expect(data.player.location).toBe('tirisfal_grove');
        engine.take('map_to_temple');
        engine.go('nathrezim_temple');
        expect(data.player.location).toBe('nathrezim_temple');
        engine.go('tirisfal_grove');
        expect(data.player.location).toBe('tirisfal_grove');
    });

    test.each(['cs', 'en'].flatMap(language => ['destroy', 'entrust', 'claim'].map(choice => [language, choice])))('in %s reaches the %s ending and keeps its text visible', (language, choice) => {
        const {engine, data, sent} = createGame(language);
        earnRewards(engine);
        choose(engine, 'forsaken_patrol', 'show_amulet');
        solveRunes(engine);
        engine.go('nathrezim_temple');
        choose(engine, 'zar_thalis', choice);
        expect(data.getValue('game_end')).toBe(true);
        expect(data.getValue('game_end_id')).toBe(`ending_${choice}`);
        engine.listEndings();
        const ending = sent.filter(message => message[2] === 'game-location').at(-1)[1];
        expect(ending).toContain('<h2>');
        expect(data.getValue('game-location-show')).toBe(true);
        for (const id of ['commands', 'characters', 'items', 'use', 'take', 'drop', 'go']) {
            expect(data.getValue(`game-${id}-show`)).toBe(false);
        }
        engine.listEndings();
        expect(data.getValue('gold_coins')).toBe(50);
    });

    test.each([
        ['fire'], ['water', 'earth'], ['water', 'fire', 'water'], ['water', 'fire', 'wind', 'wind']
    ])('allows recovery from wrong rune sequence %j', (...answers) => {
        const {engine, data} = createGame();
        for (const answer of answers) choose(engine, 'rune_keeper', answer);
        expect(data.parseCondition('rune_step = 0')).toBe(true);
        expect(data.getValue('temple_open')).toBe(false);
        solveRunes(engine);
        expect(data.getValue('temple_open')).toBe(true);
        engine.talk('rune_keeper');
        expect(engine.activeDialogues.has('rune_keeper')).toBe(false);
    });

    test('restores puzzle progress from a save and allows postponing the final decision', () => {
        const {engine, data, sent} = createGame();
        earnRewards(engine);
        choose(engine, 'forsaken_patrol', 'show_amulet');
        choose(engine, 'rune_keeper', 'water');
        const restored = new GameEngine(new GameData(JSON.parse(data.toJSON())), engine.win);
        for (const answer of ['fire', 'wind', 'earth']) choose(restored, 'rune_keeper', answer);
        restored.go('nathrezim_temple');
        restored.use('travel_journal');
        expect(sent.filter(message => message[0] === 'game-update').at(-1)[1]).toContain('Volba ukončí příběh');
        choose(restored, 'zar_thalis', 'leave');
        expect(restored.data.getValue('game_end')).toBe(false);
        restored.go('tirisfal_grove');
        restored.talk('thrall');
        restored.go('nathrezim_temple');
        choose(restored, 'zar_thalis', 'destroy');
        expect(restored.data.getValue('game_end')).toBe(true);
    });
});
