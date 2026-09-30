jest.mock('electron', () => ({ipcMain: {on: jest.fn()}}));
jest.mock('../debug_window', () => ({sendDebugState: jest.fn()}));

const GameData = require('../game_data');
const {GameEngine} = require('../game_engine');
const {parseGameFile, prepareGameDefinition} = require('../game_definition_loader');

function createGame(overrides = {}) {
    const input = {
        metadata: {title: 'Game', language: 'en'},
        locations: [{id: 'room', name: 'Room', descriptions: [{default: '<p>Room</p>'}], connections: []}],
        items: [],
        characters: [{id: 'player', name: 'Player', location: 'room'}],
        variables: [{id: 'counter', value: 0}],
        endings: [],
        ...overrides
    };
    const sent = [];
    const win = {webContents: {send: (...args) => sent.push(args)}};
    return {data: new GameData(input), engine: new GameEngine(new GameData(JSON.parse(JSON.stringify(input))), win), sent};
}

describe('GameEngine actions and endings', () => {
    test('start without intro renders only the initial location', () => {
        const {engine, sent} = createGame();
        engine.start();
        const location = sent.find(message => message[0] === 'game-update' && message[2] === 'game-location');
        expect(location[1]).toBe('<p>Room</p>');
        expect(location[1]).not.toContain('undefined');
    });

    test('command list excludes the player while keeping visible NPCs', () => {
        const {engine, sent} = createGame({
            characters: [
                {id: 'player', name: 'Player', location: 'room'},
                {id: 'npc', name: 'NPC', location: 'room'}
            ]
        });
        engine.listCommands();
        const characters = sent.find(message => message[0] === 'game-update' && message[2] === 'game-characters');
        expect(characters[1]).toContain('NPC');
        expect(characters[1]).not.toContain('Player');
    });

    test('examining a character without onSee does not execute item hooks or throw', () => {
        const {engine} = createGame({
            characters: [
                {id: 'player', name: 'Player', location: 'room'},
                {id: 'npc', name: 'NPC', location: 'room', descriptions: [{default: '<p>NPC</p>'}]}
            ]
        });
        expect(() => engine.see('npc')).not.toThrow();
        expect(engine.data.getCharacterById('npc').onSee).toBeUndefined();
    });

    test('all item hooks use first-match description and assignment semantics', () => {
        const item = {
            id: 'key', name: 'Key', owner: 'room', descriptions: [{default: '<p>Key</p>'}],
            onTake: [{condition: 'key:owner = room', description: '<p>Taken</p>', set: 'counter = counter + 1'}, {description: 'wrong', set: 'counter = 99'}],
            onDrop: [{condition: 'key:owner = player', description: '<p>Dropped</p>', set: 'counter = counter + 1'}],
            onUse: [{description: '<p>Used</p>', set: 'counter = counter + 1'}],
            onSee: [{description: '<p>Seen</p>', set: 'counter = counter + 1'}]
        };
        const {engine, sent} = createGame({items: [item]});
        engine.take('key');
        engine.drop('key');
        engine.use('key');
        engine.see('key');
        expect(engine.data.getValue('counter')).toBe(4);
        expect(engine.data.items[0].owner).toBe('room');
        expect(sent.flat().join(' ')).toContain('<p>Seen</p>');
        expect(sent.flat().join(' ')).not.toContain('wrong');
    });

    test('ending state changes execute exactly once', () => {
        const {engine} = createGame({
            variables: [{id: 'counter', value: 0}, {id: 'game_end', value: true}, {id: 'game_end_id', value: 'end'}],
            endings: [{id: 'end', descriptions: [{default: '<p>End</p>', set: 'counter = counter + 1'}]}]
        });
        engine.listEndings();
        engine.listEndings();
        expect(engine.data.getValue('counter')).toBe(1);
    });

    test('functional Test sample reaches its dialogue ending with ending-level state changes', () => {
        const {inputData} = parseGameFile('samples/test/Test.yaml');
        const data = new GameData(prepareGameDefinition(inputData));
        const sent = [];
        const engine = new GameEngine(data, {webContents: {send: (...args) => sent.push(args)}});

        engine.go('ložnice');
        engine.use('vypínač');
        engine.see('skříň');
        engine.take('klíče');
        engine.go('kuchyně');
        engine.go('předsíň');
        engine.use('dveře');
        engine.talk('osoba');
        engine.handleDialogChoice({characterId: 'osoba', entryId: 'door_greeting', choiceId: 'deliver_letter'});
        engine.listEndings();

        expect(data.getValue('game_end')).toBe(true);
        expect(data.getValue('game_end_id')).toBe('end_game_1');
        expect(data.getValue('game-location-show')).toBe(false);
        expect(sent.flat().join(' ')).toContain('game:///ENDGAME.jpg');
    });
});
